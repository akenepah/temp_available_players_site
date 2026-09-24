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

async function openFilters(user: ReturnType<typeof userEvent.setup>, trigger: RegExp = /NHL team filter/) {
  await user.click(screen.getByRole("button", { name: trigger }));
  return screen.getByRole("dialog", { name: "Filter players" });
}

const selectorButton = (panel: HTMLElement, label: string) => within(panel).getByRole("button", { description: label });

async function openSelector(user: ReturnType<typeof userEvent.setup>, panel: HTMLElement, label: string) {
  const button = selectorButton(panel, label);
  if (button.getAttribute("aria-expanded") !== "true") await user.click(button);
}

const accessibleName = (input: HTMLElement) => input.closest("label")!.textContent!.trim();

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowNames = () => bodyRows().map((row) => within(row).getByRole("button").getAttribute("aria-label")!.replace(", open player profile", ""));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("renders the skater table by default, ordered by ADP, 8 per page, without PIM", async () => {
    mockFetch();
    await renderLoaded();
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader").map((th) => th.textContent?.replace(/\s*[↑↓]/, "").trim());
    expect(headers).toEqual(["#", "Player", "Team", "Pos", "Prev. F2F", "ADP", "GP", "G", "A", "PTS", "PPP", "SOG", "HIT", "BLK", "Open"]);
    expect(headers).not.toContain("PIM");
    expect(bodyRows()).toHaveLength(8);
    expect(rowNames()[0]).toBe("Kirill Kaprizov");
    expect(screen.getByText("119 returning skaters · Yahoo ADP ↑")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–8 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 1 of 15")).toBeInTheDocument();
  });

  it("paginates and disables unavailable actions", async () => {
    mockFetch();
    const user = await renderLoaded();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 9–16 of 119 skaters")).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getAllByRole("cell")[0]).toHaveTextContent("9");
    for (let i = 0; i < 13; i++) await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 113–119 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    // Unavailable ADP sorts to the end.
    expect(within(bodyRows().at(-1)!).getAllByRole("cell")[4]).toHaveTextContent("—");
  });

  it("returns to page 1 when the query changes", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: "Sort by Points" }));
    expect(screen.getByText("Showing 1–8 of 119 skaters")).toBeInTheDocument();
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

  it("shows the empty state and clears back to the full pool", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.type(screen.getByLabelText("Search players"), "zzzz");
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
    expect(screen.getByText("Try another name or clear your filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(bodyRows()).toHaveLength(8);
    expect(screen.getByLabelText("Search players")).toHaveValue("");
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
    expect(within(panel).getByRole("radio", { name: "All NHL Teams" })).toBeChecked();
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
    const panel = await openFilters(user, /Position filter/);
    await user.click(within(panel).getByRole("checkbox", { name: "Left wing" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Right wing" }));
    expect(within(panel).getByRole("checkbox", { name: "Left wing" })).toBeChecked();
    expect(within(panel).getByRole("checkbox", { name: "Right wing" })).toBeChecked();
    expect(within(panel).getByRole("checkbox", { name: "All Positions" })).not.toBeChecked();
    expect(selectorButton(panel, "NHL Position")).toHaveTextContent("Left wing, Right wing");
    // Fixture: 30 LW + 30 RW filler plus named LW/RW players.
    const count = Number(/Show (\d+) players/.exec(within(panel).getByRole("button", { name: /^Show/ }).textContent!)![1]);
    await user.click(within(panel).getByRole("button", { name: /^Show/ }));
    expect(screen.getByText(`Showing 1–8 of ${count} skaters`)).toBeInTheDocument();
    expect(new Set(bodyRows().map((row) => within(row).getAllByRole("cell")[2]!.textContent))).toEqual(new Set(["LW", "RW"]));
    expect(screen.getByRole("button", { name: "Position filter: LW + RW" })).toBeInTheDocument();
  });

  it("returns to All Positions when every position is deselected, or via All Positions", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user, /Position filter/);
    await user.click(within(panel).getByRole("checkbox", { name: "Defense" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Defense" }));
    expect(within(panel).getByRole("checkbox", { name: "All Positions" })).toBeChecked();
    await user.click(within(panel).getByRole("checkbox", { name: "Centre" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Defense" }));
    await user.click(within(panel).getByRole("checkbox", { name: "All Positions" }));
    expect(within(panel).getByRole("checkbox", { name: "Centre" })).not.toBeChecked();
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();
  });

  it("combines team + two positions + franchise with AND, shows one chip per position, and clears", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: "Minnesota Wild" }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("Minnesota Wild");
    await openSelector(user, panel, "NHL Position");
    await user.click(within(panel).getByRole("checkbox", { name: "Left wing" }));
    await user.click(within(panel).getByRole("checkbox", { name: "Defense" }));
    expect(within(panel).getByRole("button", { name: "Show 3 players" })).toBeInTheDocument();
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: "The Offensive Otters" }));
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
    await user.click(within(panel).getByRole("radio", { name: "Minnesota Wild" }));
    await openSelector(user, panel, "NHL Team");
    await user.click(within(panel).getByRole("radio", { name: "All NHL Teams" }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("All NHL Teams");
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: "Purple Reign" }));
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: "All Franchises" }));
    expect(selectorButton(panel, "Previous F2F Franchise")).toHaveTextContent("All Franchises");
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();

    await openSelector(user, panel, "NHL Team");
    await user.click(within(panel).getByRole("radio", { name: "Dallas Stars" }));
    await openSelector(user, panel, "NHL Position");
    await user.click(within(panel).getByRole("checkbox", { name: "Centre" }));
    await openSelector(user, panel, "Previous F2F Franchise");
    await user.click(within(panel).getByRole("radio", { name: "Stache-ing Ginos" }));
    await user.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(selectorButton(panel, "NHL Team")).toHaveTextContent("All NHL Teams");
    expect(selectorButton(panel, "NHL Position")).toHaveTextContent("All Positions");
    expect(selectorButton(panel, "Previous F2F Franchise")).toHaveTextContent("All Franchises");
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // A team with no available players applies cleanly to the empty state.
    panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: "Philadelphia Flyers" }));
    await user.click(within(panel).getByRole("button", { name: "Show 0 players" }));
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
  });

  it("combines search with filters and uses the filtered set for profile navigation", async () => {
    mockFetch();
    const user = await renderLoaded();
    const panel = await openFilters(user);
    await user.click(within(panel).getByRole("radio", { name: "Minnesota Wild" }));
    await user.click(within(panel).getByRole("button", { name: "Show 3 players" }));
    await user.click(screen.getByRole("button", { name: "Kirill Kaprizov, open player profile" }));
    expect(within(screen.getByRole("dialog")).getByText("1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next player" }));
    expect(screen.getByRole("dialog", { name: /Brock Faber/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.type(screen.getByLabelText("Search players"), "blake");
    expect(rowNames()).toEqual(["Blake Coleman"]);
  });

  it("hides skater positions in goalie mode", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Goalies" }));
    const panel = await openFilters(user, /Position filter/);
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

  it("uses the mobile composition: 6 per page, sort screen, filter screen, full-screen profile", async () => {
    viewport.mobile = true;
    mockFetch();
    const user = await renderLoaded();
    expect(bodyRows()).toHaveLength(6);
    expect(screen.getByPlaceholderText("Search players...")).toBeInTheDocument();
    expect(screen.getByText("2025–26 actuals · Swipe stats →")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Showing 7–12 of 119 skaters")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 2 of 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Sort:/ }));
    const sortScreen = screen.getByRole("dialog", { name: "Sort players" });
    expect(within(sortScreen).getByText("Unavailable values always appear last.")).toBeInTheDocument();
    expect(within(sortScreen).getByRole("button", { name: "Yahoo ADP · Low to high" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(sortScreen).getByRole("button", { name: "Points · High to low" }));
    expect(screen.getByRole("button", { name: "Sort: Points ↓" })).toBeInTheDocument();

    const filterScreen = await openFilters(user, /Position filter/);
    expect(within(filterScreen).getByRole("button", { name: "‹ Back to players" })).toBeInTheDocument();
    await user.click(within(filterScreen).getByRole("checkbox", { name: "Centre" }));
    await user.click(within(filterScreen).getByRole("checkbox", { name: "Defense" }));
    await user.click(within(filterScreen).getByRole("button", { name: /^Show \d+ players$/ }));
    expect(screen.getByRole("button", { name: "Position filter: C + D" })).toBeInTheDocument();
    expect(screen.getByText("Showing 1–6 of", { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    await user.click(screen.getByRole("button", { name: "Martin Necas, open player profile" }));
    const sheet = screen.getByRole("dialog", { name: /Martin Necas/ });
    await user.click(within(sheet).getByRole("button", { name: "Next player" }));
    expect(screen.getByRole("dialog", { name: /Kirill Kaprizov/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "‹ Back" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // List state is preserved.
    expect(screen.getByRole("button", { name: "Sort: Points ↓" })).toBeInTheDocument();
    expect(rowNames()[0]).toBe("Martin Necas");
  });
});
