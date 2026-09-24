import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_SNAPSHOT } from "../../tests/fixtures/pool";
import { viewport } from "../test/setup-dom";
import { AvailablePlayersPage } from "./AvailablePlayersPage";

const fixtureResponse = () => new Response(JSON.stringify(FIXTURE_SNAPSHOT), { status: 200 });

function mockFetch(...responses: (() => Response | Promise<Response>)[]) {
  const fetchMock = vi.fn();
  for (const respond of responses) fetchMock.mockImplementationOnce(async () => respond());
  fetchMock.mockImplementation(async () => fixtureResponse());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderLoaded() {
  const user = userEvent.setup();
  render(<AvailablePlayersPage />);
  await screen.findByRole("table");
  return user;
}

async function openFilters(user: ReturnType<typeof userEvent.setup>, section: "team" | "position" | "franchise" = "team") {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  const panel = screen.getByRole("dialog", { name: /Filter players/ });
  if (section === "position") await openSelector(user, panel, "NHL Position");
  if (section === "franchise") await openSelector(user, panel, "Previous F2F Franchise");
  return panel;
}

/** Filter options are announced with their live count, e.g. "Minnesota Wild, 3 players". */
const option = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, \\d+ players?$`);

const selectorButton = (panel: HTMLElement, label: string) => within(panel).getByRole("button", { description: label });

async function openSelector(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement, label: string) {
  const button = selectorButton(panel, label);
  if (button.getAttribute("aria-expanded") !== "true") await user.click(button);
}

const accessibleName = (input: HTMLElement) => input.closest("label")!.querySelector(".option-row__text")!.textContent!.trim();

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowNames = () => bodyRows().map((row) => within(row).getByRole("button").getAttribute("aria-label")!.replace(", open player profile", ""));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Available Players page", () => {
  it("loads the public pool from the snapshot with no authentication", async () => {
    const fetchMock = mockFetch();
    await renderLoaded();
    expect(fetchMock).toHaveBeenCalledWith("/data/available-players.json", expect.anything());
    expect(screen.getByRole("heading", { level: 1, name: "Available Players" })).toBeInTheDocument();
    const summary = screen.getByLabelText("Pool summary");
    expect(within(summary).getByText("142")).toBeInTheDocument();
    expect(within(summary).getByText("10/10")).toBeInTheDocument();
    expect(within(summary).getByText("Sep 23, 2026")).toBeInTheDocument();
  });

  it("shows three summary metrics, no commissioner notice, and the registry brand line", async () => {
    mockFetch();
    await renderLoaded();
    const summary = screen.getByLabelText("Pool summary");
    expect(within(summary).getAllByRole("term").map((dt) => dt.textContent)).toEqual(["Available players", "Keeper decisions", "Last updated"]);
    expect(screen.queryByText(/commissioner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Returning Draft Pool/i)).not.toBeInTheDocument();
    expect(screen.getByText("2026–2027 Player Registry")).toBeInTheDocument();
    expect(screen.getAllByText(/Player Registry/)).toHaveLength(1);
    expect(screen.queryByText(/Fantasy Hockey/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Scouting the pool/i)).not.toBeInTheDocument();
    // The last-updated date lives only in the summary strip, not the header.
    expect(screen.queryByText(/Updated ·/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Sep 23, 2026")).toHaveLength(1);
  });

  it("shows the loading state inside the page chrome", async () => {
    let resolve!: (response: Response) => void;
    mockFetch(() => new Promise<Response>((r) => (resolve = r)));
    render(<AvailablePlayersPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading player pool");
    expect(screen.getByText("Fetching the latest available player list.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    resolve(fixtureResponse());
    await screen.findByRole("table");
  });

  it("shows the error state and retries", async () => {
    const fetchMock = mockFetch(() => new Response("missing", { status: 404 }));
    const user = userEvent.setup();
    render(<AvailablePlayersPage />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Player pool unavailable");
    expect(alert).toHaveTextContent("We couldn’t load the player list. Please try again.");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("table");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an invalid snapshot as an error, not an empty pool", async () => {
    mockFetch(() => new Response(JSON.stringify({ ...FIXTURE_SNAPSHOT, players: [{ id: "x" }] }), { status: 200 }));
    render(<AvailablePlayersPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Player pool unavailable");
  });

  it("renders the skater table by default, ordered by ADP, 20 per page, without PIM", async () => {
    mockFetch();
    await renderLoaded();
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent?.replace(/\s*[↑↓]/, "").trim());
    expect(headers).toEqual(["#", "Player", "Team", "Pos", "Prev. F2F", "ADP", "GP", "G", "A", "PTS", "PPP", "SOG", "HIT", "BLK", "Open"]);
    expect(headers).not.toContain("PIM");
    expect(bodyRows()).toHaveLength(20);
    expect(rowNames()[0]).toBe("Kirill Kaprizov");
    expect(screen.getByText("119 returning skaters · Yahoo ADP ↑")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–20 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 1 of 6")).toBeInTheDocument();
  });

  it("paginates and disables unavailable actions", async () => {
    mockFetch();
    const user = await renderLoaded();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 21–40 of 119 skaters")).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getAllByRole("cell")[0]).toHaveTextContent("21");
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 101–119 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    // Unavailable ADP sorts to the end.
    expect(within(bodyRows().at(-1)!).getAllByRole("cell")[4]).toHaveTextContent("—");
  });

  it("returns to page 1 when the query changes", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Sort by Points" }));
    expect(screen.getByText("Showing 1–20 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByText("119 skaters · Points high to low")).toBeInTheDocument();
    expect(rowNames()[0]).toBe("Martin Necas");
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("searches immediately and reports the match count", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.type(screen.getByLabelText("Search players"), "necas");
    expect(rowNames()).toEqual(["Martin Necas"]);
    expect(screen.getByText("1 match for “necas”")).toBeInTheDocument();
  });

  it("explains an empty result and offers a separate way out for search and for filters", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.type(screen.getByLabelText("Search players"), "zzzz");
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
    expect(screen.getByText("No players match “zzzz”.")).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "No players found" }).parentElement!;
    expect(within(card).queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Clear search" }));
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByLabelText("Search players")).toHaveValue("");

    // Search + filters: clearing the search keeps the filters.
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    await user.type(screen.getByLabelText("Search players"), "zzzz");
    expect(screen.getByText("No players match “zzzz” with these filters.")).toBeInTheDocument();
    const both = screen.getByRole("heading", { name: "No players found" }).parentElement!;
    await user.click(within(both).getByRole("button", { name: "Clear search" }));
    expect(rowNames()).toEqual(["Kirill Kaprizov", "Brock Faber", "Blake Coleman"]);
    expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeInTheDocument();
  });

  it("lists all 32 NHL teams alphabetically, including teams with no available players", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    await openSelector(user, panel, "NHL Team");
    const teams = within(panel).getAllByRole("radio").map((radio) => radio.getAttribute("name") === "filter-team" && accessibleName(radio)).filter(Boolean);
    expect(teams[0]).toBe("All NHL Teams");
    expect(teams.slice(1)).toHaveLength(32);
    expect(teams.slice(1)).toEqual([...teams.slice(1)].sort((a, b) => String(a).localeCompare(String(b))));
    expect(teams).toContain("Philadelphia Flyers"); // no available players in the fixture pool
    expect(teams).toContain("Utah Mammoth");
    expect(within(panel).getByRole("radio", { name: option("All NHL Teams") })).toBeChecked();
  });

  it("lists exactly the 10 canonical franchises and never Jet Blue Holiday", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    await openSelector(user, panel, "Previous F2F Franchise");
    const names = within(panel)
      .getAllByRole("radio")
      .filter((radio) => radio.getAttribute("name") === "filter-franchise")
      .map(accessibleName);
    expect(names).toEqual([
      "All Franchises",
      "Bestial Backwoods Delight",
      "F U Shoresy",
      "If It Makes You Saad",
      "Josh’s Team",
      "McCabe'n It Real Goes Wrong",
      "Purple Reign",
      "Stache-ing Ginos",
      "The Offensive Otters",
      "Timbitches",
      "Weekend At Beniers",
    ]);
    expect(within(panel).queryByText(/Jet Blue/)).not.toBeInTheDocument();
  });

  it("supports multi-select positions (OR) that stay open while choosing", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user, "position");
    await user.click(within(panel).getByRole("checkbox", { name: option("Left wing") }));
    await user.click(within(panel).getByRole("checkbox", { name: option("Right wing") }));
    expect(within(panel).getByRole("checkbox", { name: option("Left wing") })).toBeChecked();
    expect(within(panel).getByRole("checkbox", { name: option("Right wing") })).toBeChecked();
    expect(within(panel).getByRole("checkbox", { name: option("All Positions") })).not.toBeChecked();
    expect(selectorButton(panel, "NHL Position")).toHaveTextContent("Left wing, Right wing");
    // Fixture: 30 LW + 30 RW filler plus named LW/RW players.
    const count = Number(/Show (\d+) players/.exec(within(panel).getByRole("button", { name: /^Show/ }).textContent!)![1]);
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    expect(screen.getByText(`Showing 1–20 of ${count} skaters`)).toBeInTheDocument();
    expect(new Set(bodyRows().map((row) => within(row).getAllByRole("cell")[2]!.textContent))).toEqual(new Set(["LW", "RW"]));
    expect(screen.getByRole("button", { name: "Filters, 2 active" })).toHaveTextContent("Filters(2)");
  });

  it("returns to All Positions when every position is deselected, or via All Positions", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user, "position");
    await user.click(within(panel).getByRole("checkbox", { name: option("Defense") }));
    await user.click(within(panel).getByRole("checkbox", { name: option("Defense") }));
    expect(within(panel).getByRole("checkbox", { name: option("All Positions") })).toBeChecked();
    await user.click(within(panel).getByRole("checkbox", { name: option("Centre") }));
    await user.click(within(panel).getByRole("checkbox", { name: option("Defense") }));
    await user.click(within(panel).getByRole("checkbox", { name: option("All Positions") }));
    expect(within(panel).getByRole("checkbox", { name: option("Centre") })).not.toBeChecked();
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();
  });

  it("combines team + two positions + franchise with AND, shows one chip per position, and clears", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("Minnesota Wild");
    await openSelector(user, panel, "NHL Position");
    await user.click(within(panel).getByRole("checkbox", { name: option("Left wing") }));
    await user.click(within(panel).getByRole("checkbox", { name: option("Defense") }));
    expect(within(panel).getByRole("button", { name: "Show 3 players" })).toBeInTheDocument();
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: option("The Offensive Otters") }));
    // MIN AND (LW OR D) AND The Offensive Otters
    await user.click(within(panel).getByRole("button", { name: "Show 1 player" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Kirill Kaprizov"]);
    expect(screen.getByText("Showing 1–1 of 1 skater")).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Applied filters" });
    expect(within(chips).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "Remove filter Minnesota Wild",
      "Remove filter Left wing",
      "Remove filter Defense",
      "Remove filter The Offensive Otters",
      "Clear all filters",
    ]);
    expect(screen.getByText("1 matching player · Minnesota · LW · D · The Offensive Otters")).toBeInTheDocument();

    // Removing one position chip keeps the other.
    await user.click(within(chips).getByRole("button", { name: "Remove filter The Offensive Otters" }));
    await user.click(within(chips).getByRole("button", { name: "Remove filter Left wing" }));
    expect(rowNames()).toEqual(["Brock Faber"]);
    expect(within(chips).getByRole("button", { name: "Remove filter Defense" })).toBeInTheDocument();
    expect(within(chips).queryByRole("button", { name: "Remove filter Left wing" })).not.toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "Clear all filters" }));
    expect(screen.queryByRole("group", { name: "Applied filters" })).not.toBeInTheDocument();
    expect(screen.getByText("119 returning skaters · Yahoo ADP ↑")).toBeInTheDocument();
  });

  it("clears single dimensions with the All options and every dimension with Clear", async () => {
    mockFetch();
    const user = await renderLoaded();
    let panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    await openSelector(user, panel, "NHL Team");
    await user.click(within(panel).getByRole("radio", { name: option("All NHL Teams") }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("All NHL Teams");
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: option("Purple Reign") }));
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: option("All Franchises") }));
    expect(selectorButton(panel, "Previous F2F Franchise")).toHaveTextContent("All Franchises");
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();

    await openSelector(user, panel, "NHL Team");
    await user.click(within(panel).getByRole("radio", { name: option("Dallas Stars") }));
    await openSelector(user, panel, "NHL Position");
    await user.click(within(panel).getByRole("checkbox", { name: option("Centre") }));
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: option("Stache-ing Ginos") }));
    await user.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("All NHL Teams");
    expect(selectorButton(panel, "NHL Position")).toHaveTextContent("All Positions");
    expect(selectorButton(panel, "Previous F2F Franchise")).toHaveTextContent("All Franchises");
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // A team with no available players applies cleanly to the empty state.
    panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Philadelphia Flyers") }));
    await user.click(within(panel).getByRole("button", { name: "Show 0 players" }));
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
  });

  it("combines search with filters and uses the filtered set for profile navigation", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    await user.click(within(panel).getByRole("button", { name: "Show 3 players" }));
    await user.click(screen.getByRole("button", { name: "Kirill Kaprizov, open player profile" }));
    expect(within(screen.getByRole("dialog")).getByText("1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next player" }));
    expect(screen.getByRole("dialog", { name: /Brock Faber/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.type(screen.getByLabelText("Search players"), "blake");
    expect(rowNames()).toEqual(["Blake Coleman"]);
  });

  it("puts the open profile in the URL so browser Back closes it", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Kirill Kaprizov, open player profile" }));
    expect(window.location.search).toBe("?player=kaprizov");

    // Previous/Next replace the entry rather than stacking history, so one
    // Back from Necas returns to the list, not to Kaprizov.
    await user.click(screen.getByRole("button", { name: "Next player" }));
    expect(window.location.search).toBe("?player=necas");

    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.search).toBe("");
  });

  it("clears the URL when the profile is closed from the UI", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Martin Necas, open player profile" }));
    expect(window.location.search).toBe("?player=necas");
    await user.click(screen.getByRole("button", { name: "Close player profile" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.search).toBe("");
  });

  it("opens a linked player's profile on load, switching to goalies when needed", async () => {
    window.history.replaceState(null, "", "/?player=vasilevskiy");
    mockFetch();
    await renderLoaded();
    expect(await screen.findByRole("dialog", { name: /Andrei Vasilevskiy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Goalies" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores and removes an unknown player link", async () => {
    window.history.replaceState(null, "", "/?player=nobody");
    mockFetch();
    await renderLoaded();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("offers a clear button in the search field once something is typed", async () => {
    mockFetch();
    const user = await renderLoaded();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search players"), "necas");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Search players")).toHaveValue("");
    expect(screen.getByLabelText("Search players")).toHaveFocus();
    expect(bodyRows()).toHaveLength(20);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    // Escape in the search field clears it too.
    await user.type(screen.getByLabelText("Search players"), "necas");
    await user.keyboard("{Escape}");
    expect(screen.getByLabelText("Search players")).toHaveValue("");
  });

  it("clears only the search with ×, and only the filters with Clear filters", async () => {
    mockFetch();
    const user = await renderLoaded();
    const clearFilters = screen.getByRole("button", { name: "Clear filters" });
    expect(clearFilters).toBeDisabled();
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    await user.click(screen.getByRole("button", { name: "Sort by Points" }));
    await user.type(screen.getByLabelText("Search players"), "k");

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Search players")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute("aria-sort", "descending");

    await user.type(screen.getByLabelText("Search players"), "kap");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Search players")).toHaveValue("kap");
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  it("shows live counts beside filter options and the active count in the panel", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    expect(within(panel).getByRole("radio", { name: "Minnesota Wild, 3 players" })).toBeInTheDocument();
    expect(within(panel).getByRole("radio", { name: "Philadelphia Flyers, 0 players" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("radio", { name: option("Minnesota Wild") }));
    expect(within(panel).getByRole("heading", { name: "Filter players (1)" })).toBeInTheDocument();
    await openSelector(user, panel, "NHL Position");
    // Counts for a dimension keep the other selections: Minnesota has 2 LW and 1 D.
    expect(within(panel).getByRole("checkbox", { name: "Left wing, 2 players" })).toBeInTheDocument();
    expect(within(panel).getByRole("checkbox", { name: "Defense, 1 player" })).toBeInTheDocument();
  });

  it("lets the reader choose how many players to show per page", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    const perPage = screen.getByRole("combobox", { name: "Rows per page" });
    expect(perPage).toHaveValue("20");
    expect([...(perPage as HTMLSelectElement).options].map((o) => o.value)).toEqual(["10", "20", "50"]);
    await user.selectOptions(perPage, "50");
    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText("Showing 1–50 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 1 of 3")).toBeInTheDocument();
    expect(window.location.search).toBe("?size=50");
    await user.selectOptions(perPage, "10");
    expect(screen.getByLabelText("Page 1 of 12")).toBeInTheDocument();
  });

  it("restores the whole browse state from the URL on load or refresh", async () => {
    window.history.replaceState(null, "", "/?q=a&team=MIN&pos=LW,D&sort=pts&size=10&page=1");
    mockFetch();
    await renderLoaded();
    expect(screen.getByLabelText("Search players")).toHaveValue("a");
    expect(screen.getByRole("button", { name: "Filters, 3 active" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PTS/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveValue("10");
    // MIN AND (LW OR D) AND name contains "a": Kaprizov, Faber, Coleman.
    expect(rowNames()).toEqual(["Kirill Kaprizov", "Brock Faber", "Blake Coleman"]);
  });

  it("restores the page from the URL", async () => {
    window.history.replaceState(null, "", "/?page=3");
    mockFetch();
    await renderLoaded();
    expect(screen.getByText("Showing 41–60 of 119 skaters")).toBeInTheDocument();
  });

  it("settles a page past the end on the last page", async () => {
    window.history.replaceState(null, "", "/?page=99");
    mockFetch();
    await renderLoaded();
    expect(screen.getByText("Showing 101–119 of 119 skaters")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?page=6"));
  });

  it("keeps filters, search, sort and page when a profile is closed", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user, "position");
    await user.click(within(panel).getByRole("checkbox", { name: option("Centre") }));
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    await user.click(screen.getByRole("button", { name: "Sort by Points" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "10");
    await user.click(screen.getByRole("button", { name: /Next/ }));
    const listUrl = window.location.search;
    expect(listUrl).toBe("?pos=C&sort=pts&page=2&size=10");

    await user.click(bodyRows()[0]!.querySelector<HTMLButtonElement>(".player-open")!);
    expect(window.location.search).toMatch(/^\?pos=C&sort=pts&page=2&size=10&player=/);
    await user.click(screen.getByRole("button", { name: "Close player profile" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.search).toBe(listUrl);
    expect(screen.getByText("Showing 11–20 of", { exact: false })).toBeInTheDocument();
  });

  it("steps Back and Forward through filter and page changes", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: option("Dallas Stars") }));
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    expect(window.location.search).toBe("?team=DAL");
    await user.click(screen.getByRole("button", { name: "Goalies" }));
    expect(window.location.search).toBe("?tab=goalies&team=DAL");

    window.history.back();
    await waitFor(() => expect(screen.getByRole("button", { name: "Skaters" })).toHaveAttribute("aria-pressed", "true"));
    expect(rowNames()).toEqual(["Wyatt Johnston", "Miro Heiskanen"]);
    window.history.back();
    await waitFor(() => expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument());
    window.history.forward();
    await waitFor(() => expect(screen.getByRole("button", { name: "Filters, 1 active" })).toBeInTheDocument());
  });

  it("reopens a player with Forward after Back closed it", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Martin Necas, open player profile" }));
    window.history.back();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    window.history.forward();
    expect(await screen.findByRole("dialog", { name: /Martin Necas/ })).toBeInTheDocument();
  });

  it("keeps the search in the URL as the reader types", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.type(screen.getByLabelText("Search players"), "kap");
    expect(window.location.search).toBe("?q=kap");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(window.location.search).toBe("");
  });

  it("hides skater positions in goalie mode", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Goalies" }));
    const panel = await openFilters(user);
    expect(within(panel).queryByRole("button", { description: "NHL Position" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Show 23 players" })).toBeInTheDocument();
  });

  it("switches to goalies with goalie-specific columns", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Goalies" }));
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent?.replace(/\s*[↑↓]/, "").trim());
    expect(headers).toEqual(["#", "Player", "Team", "Pos", "Prev. F2F", "ADP", "GP", "W", "SV", "SV%", "Open"]);
    expect(rowNames()[0]).toBe("Andrei Vasilevskiy");
    expect(within(bodyRows()[0]!).getByText(".912")).toBeInTheDocument();
    expect(screen.getByText("23 returning goalies · Yahoo ADP ↑")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Goalies" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the profile from anywhere on the row and steps through the current results", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(within(bodyRows()[0]!).getByText("The Offensive Otters"));
    const drawer = screen.getByRole("dialog", { name: /Kirill Kaprizov/ });
    expect(within(drawer).getByText("1 of 119")).toBeInTheDocument();
    expect(within(drawer).getByText("LW / Minnesota Wild")).toBeInTheDocument();
    expect(within(drawer).getByText("Contract expired")).toBeInTheDocument();
    expect(within(drawer).getByText("2026–27 · Returning player")).toBeInTheDocument();
    const tiles = within(drawer).getAllByRole("listitem").map((li) => li.textContent);
    // Top row GP · G · A · PTS, bottom row PPP · SOG · HIT · BLK.
    expect(tiles).toEqual(["78GP", "45G", "44A", "89PTS", "32PPP", "269SOG", "52HIT", "27BLK"]);
    expect(within(drawer).getByRole("button", { name: "Previous player" })).toBeDisabled();

    await user.click(within(drawer).getByRole("button", { name: "Next player" }));
    const next = screen.getByRole("dialog", { name: /Martin Necas/ });
    expect(within(next).getByText("2 of 119")).toBeInTheDocument();

    await user.click(within(next).getByRole("tab", { name: "Stats" }));
    expect(within(next).getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
    expect(within(next).getByText("Power-play points")).toBeInTheDocument();
    await user.click(within(next).getByRole("tab", { name: "Context" }));
    expect(within(next).getByText("Previous F2F team")).toBeInTheDocument();
    expect(within(next).getByText("Purple Reign")).toBeInTheDocument();
  });

  it("closes the drawer with Escape and restores focus to the opening control", async () => {
    mockFetch();
    const user = await renderLoaded();
    const trigger = screen.getByRole("button", { name: "Kirill Kaprizov, open player profile" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close player profile" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows goalie stat tiles in the goalie profile", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Goalies" }));
    await user.click(screen.getByRole("button", { name: "Andrei Vasilevskiy, open player profile" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["58GP", "39W", "1353SV", ".912SV%"]);
    expect(within(drawer).getByText("1 of 23")).toBeInTheDocument();
  });

  it("falls back for missing portrait, team and ADP without inventing values", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.type(screen.getByLabelText("Search players"), "evander");
    const row = bodyRows()[0]!;
    expect(within(row).getByTestId("portrait-fallback")).toHaveTextContent("EK");
    expect(within(row).getByText("McCabe'n It Real Goes Wrong")).toBeInTheDocument();
    await user.click(within(row).getByRole("button"));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("LW / NHL team unassigned")).toBeInTheDocument();
    expect(within(drawer).getByText("Portrait unavailable")).toBeInTheDocument();
    expect(within(drawer).getByText("ADP unavailable. This player remains in the draft pool.")).toBeInTheDocument();
    expect(within(drawer).getByText("Yahoo ADP").textContent).toContain("—");
    expect(within(drawer).getByText("Released")).toBeInTheDocument();
  });

  it("uses the mobile composition: sort screen, filter screen, swipe cue, full-screen profile", async () => {
    viewport.mobile = true;
    mockFetch();
    const user = await renderLoaded();
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByPlaceholderText("Search players...")).toBeInTheDocument();
    expect(screen.getByText("2025–26 actuals · Swipe for more stats →")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 21–40 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 2 of 6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Sort:/ }));
    const sortScreen = screen.getByRole("dialog", { name: "Sort players" });
    expect(within(sortScreen).getByText("Unavailable values always appear last.")).toBeInTheDocument();
    expect(within(sortScreen).getByRole("button", { name: "Yahoo ADP · Low to high" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(sortScreen).getByRole("button", { name: "Points · High to low" }));
    expect(screen.getByRole("button", { name: "Sort: Points ↓" })).toBeInTheDocument();

    const filterScreen = await openFilters(user, "position");
    expect(within(filterScreen).getByRole("button", { name: "‹ Back to players" })).toBeInTheDocument();
    await user.click(within(filterScreen).getByRole("checkbox", { name: option("Centre") }));
    await user.click(within(filterScreen).getByRole("checkbox", { name: option("Defense") }));
    await user.click(within(filterScreen).getByRole("button", { name: /^Show \d+ players$/ }));
    expect(screen.getByRole("button", { name: "Filters, 2 active" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1–20 of", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    await user.click(screen.getByRole("button", { name: "Martin Necas, open player profile" }));
    const sheet = screen.getByRole("dialog", { name: /Martin Necas/ });
    await user.click(within(sheet).getByRole("button", { name: "Next player" }));
    expect(screen.getByRole("dialog", { name: /Kirill Kaprizov/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // List state is preserved.
    expect(screen.getByRole("button", { name: "Sort: Points ↓" })).toBeInTheDocument();
    expect(rowNames()[0]).toBe("Martin Necas");
  });
});
