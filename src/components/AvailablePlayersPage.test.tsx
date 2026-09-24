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
    expect(within(summary).getByText("Purple Reign")).toBeInTheDocument();
    expect(within(summary).getByText("Sep 23, 2026")).toBeInTheDocument();
    expect(screen.getByText("Includes Purple Reign’s 15 returns using commissioner-selected keepers.")).toBeInTheDocument();
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

  it("combines filters in the panel, shows removable chips, and clears all", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /NHL team filter/ }));
    const panel = screen.getByRole("dialog", { name: "Filter players" });
    await user.click(within(panel).getByRole("button", { name: "Minnesota Wild" }));
    await user.click(within(panel).getByRole("button", { name: "Left wing" }));
    expect(within(panel).getByRole("button", { name: "Minnesota Wild" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("button", { name: "McCabe'n It Real Goes Wrong" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Jet Blue/ })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Show 2 players" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rowNames()).toEqual(["Kirill Kaprizov", "Blake Coleman"]);
    const chips = screen.getByRole("group", { name: "Applied filters" });
    expect(within(chips).getByText("2 matching players")).toBeInTheDocument();
    expect(screen.getByText("2 matching players · Minnesota · LW")).toBeInTheDocument();

    await user.click(within(chips).getByRole("button", { name: "Remove filter Left wing" }));
    expect(bodyRows().length).toBeGreaterThan(2);
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(screen.queryByRole("group", { name: "Applied filters" })).not.toBeInTheDocument();
    expect(screen.getByText("119 returning skaters · Yahoo ADP ↑")).toBeInTheDocument();
  });

  it("filters by previous franchise and clears staged selections", async () => {
    mockFetch();
    const user = await renderLoaded();
    await user.click(screen.getByRole("button", { name: /Position filter/ }));
    const panel = screen.getByRole("dialog", { name: "Filter players" });
    await user.click(within(panel).getByRole("button", { name: "Purple Reign" }));
    await user.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(within(panel).getByRole("button", { name: "Show 119 players" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Purple Reign" }));
    await user.click(within(panel).getByRole("button", { name: /^Show \d+ players$/ }));
    expect(bodyRows().every((row) => within(row).getByText("Purple Reign"))).toBe(true);
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
    expect(tiles).toEqual(["89PTS", "45Goals", "44Assists", "32PPP", "78GP", "269SOG", "52HIT", "27BLK"]);
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

    await user.click(screen.getByRole("button", { name: /NHL team filter/ }));
    const filterScreen = screen.getByRole("dialog", { name: "Filter players" });
    expect(within(filterScreen).getByRole("button", { name: "‹ Back to players" })).toBeInTheDocument();
    await user.click(within(filterScreen).getByRole("button", { name: "‹ Back to players" }));

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
