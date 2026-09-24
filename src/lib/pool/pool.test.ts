import { describe, expect, it } from "vitest";
import { FIXTURE_SNAPSHOT } from "../../../tests/fixtures/pool";
import { formatAdp, formatDate, formatSavePct, formatSeasonLong } from "./format";
import {
  applyQuery,
  DEFAULT_SORT,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  activeFilterCount,
  facetCounts,
  EMPTY_FILTERS,
  initialQuery,
  paginate,
  sortOptionsFor,
  sortPlayers,
  switchType,
  hasActiveFilters,
  positionsFor,
  togglePosition,
  type Filters,
  type PoolQuery,
} from "./query";
import { FRANCHISES, NHL_TEAMS } from "./reference";
import { SKATER_COLUMNS, tileColumnsFor } from "./stats";
import { parseSnapshot, SnapshotValidationError } from "./validate";
import { DEFAULT_VIEW, parseViewState, serializeViewState, type ViewState } from "./urlState";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const snapshot = parseSnapshot(clone(FIXTURE_SNAPSHOT));
const players = snapshot.players;
const query = (overrides: Partial<PoolQuery> = {}): PoolQuery => ({ ...initialQuery(), ...overrides });

describe("snapshot parsing", () => {
  it("parses the reference composition: 119 skaters + 23 goalies = 142", () => {
    expect(players).toHaveLength(142);
    expect(players.filter((p) => p.type === "skater")).toHaveLength(119);
    expect(players.filter((p) => p.type === "goalie")).toHaveLength(23);
  });

  it("keeps players whose ADP, team, portrait and stats are unavailable", () => {
    const kane = players.find((p) => p.id === "kane")!;
    expect(kane.adp).toBeNull();
    expect(kane.nhlTeam).toBeNull();
    expect(kane.portraitUrl).toBeNull();
    expect(kane.stats.gp).toBeNull();
  });

  it("resolves obsolete franchise ids to the canonical current name", () => {
    const kane = players.find((p) => p.id === "kane")!;
    expect(kane.previousFranchise.name).toBe("McCabe'n It Real Goes Wrong");
    expect(players.some((p) => p.previousFranchise.name === "Jet Blue Holiday")).toBe(false);
  });

  it("accepts commissionerSelection as null or as a franchise selection", () => {
    expect(snapshot.commissionerSelection).toBeNull();
    const raw = clone(FIXTURE_SNAPSHOT) as Record<string, unknown>;
    raw.commissionerSelection = { franchiseId: "purple-reign", returnCount: 15 };
    expect(parseSnapshot(raw).commissionerSelection?.franchise.name).toBe("Purple Reign");
  });

  it("rejects the whole snapshot on an invalid record instead of dropping it", () => {
    const raw = clone(FIXTURE_SNAPSHOT);
    raw.players[0]!.previousFranchiseId = "not-a-franchise";
    raw.players[1]!.adp = -3;
    expect(() => parseSnapshot(raw)).toThrow(SnapshotValidationError);
    try {
      parseSnapshot(raw);
    } catch (error) {
      expect((error as SnapshotValidationError).issues).toEqual([
        expect.stringContaining("players[0].previousFranchiseId"),
        expect.stringContaining("players[1].adp"),
      ]);
    }
  });

  it("rejects duplicate ids and a save percentage that is not a fraction", () => {
    const raw = clone(FIXTURE_SNAPSHOT);
    raw.players[1]!.id = raw.players[0]!.id;
    const goalie = raw.players.find((p) => p.position === "G")!;
    goalie.stats.svPct = 91.2;
    expect(() => parseSnapshot(raw)).toThrow(/duplicate id[\s\S]*svPct/);
  });
});

describe("sorting", () => {
  it("defaults to Yahoo ADP low to high", () => {
    expect(initialQuery().sort).toEqual({ key: "adp", direction: "asc" });
    const names = applyQuery(players, query()).slice(0, 3).map((p) => p.fullName);
    expect(names).toEqual(["Kirill Kaprizov", "Martin Necas", "Wyatt Johnston"]);
  });

  it("always sorts unavailable ADP last, in either direction", () => {
    for (const direction of ["asc", "desc"] as const) {
      const sorted = sortPlayers(players, { key: "adp", direction });
      const firstNull = sorted.findIndex((p) => p.adp === null);
      expect(firstNull).toBeGreaterThan(0);
      expect(sorted.slice(firstNull).every((p) => p.adp === null)).toBe(true);
    }
  });

  it("sorts points high to low with unavailable stats last", () => {
    const sorted = applyQuery(players, query({ sort: { key: "pts", direction: "desc" } }));
    expect(sorted[0]!.fullName).toBe("Martin Necas");
    expect(sorted.at(-1)!.fullName).toBe("Evander Kane");
  });

  it("offers the approved mobile skater sort options and goalie-only options for goalies", () => {
    expect(sortOptionsFor("skater").map((o) => o.label)).toEqual([
      "Yahoo ADP · Low to high",
      "Points · High to low",
      "Goals · High to low",
      "Assists · High to low",
      "Hits · High to low",
      "Blocks · High to low",
      "Player name · A to Z",
    ]);
    const goalieLabels = sortOptionsFor("goalie").map((o) => o.label).join(" ");
    expect(goalieLabels).toMatch(/Wins/);
    expect(goalieLabels).not.toMatch(/Points|Hits|Blocks|Goals/);
  });
});

describe("search and filters", () => {
  it("searches by player name, accent-insensitively", () => {
    expect(applyQuery(players, query({ search: "necas" })).map((p) => p.fullName)).toEqual(["Martin Necas"]);
    expect(applyQuery(players, query({ search: "stutzle" })).map((p) => p.fullName)).toEqual(["Tim Stützle"]);
  });

  it("searches by NHL team and position", () => {
    expect(applyQuery(players, query({ search: "minnesota wild" })).every((p) => p.nhlTeam?.abbrev === "MIN")).toBe(true);
    expect(applyQuery(players, query({ search: "defense" })).every((p) => p.position === "D")).toBe(true);
  });

  const filtered = (filters: Partial<Filters>, extra: Partial<PoolQuery> = {}) =>
    applyQuery(players, query({ ...extra, filters: { ...EMPTY_FILTERS, ...filters } }));
  const skaterCount = players.filter((p) => p.type === "skater").length;

  it("filters by NHL team alone", () => {
    const result = filtered({ team: "MIN" });
    expect(result.map((p) => p.fullName)).toEqual(["Kirill Kaprizov", "Brock Faber", "Blake Coleman"]);
  });

  it("filters by previous franchise alone", () => {
    const result = filtered({ franchise: "purple-reign" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.previousFranchise.id === "purple-reign")).toBe(true);
  });

  it("filters by one position", () => {
    const result = filtered({ positions: ["D"] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.position === "D")).toBe(true);
  });

  it("treats multiple positions as OR within the position dimension", () => {
    const lw = filtered({ positions: ["LW"] }).length;
    const rw = filtered({ positions: ["RW"] }).length;
    const both = filtered({ positions: ["LW", "RW"] });
    expect(both).toHaveLength(lw + rw);
    expect(new Set(both.map((p) => p.position))).toEqual(new Set(["LW", "RW"]));
  });

  it("returns every skater when all four positions are selected", () => {
    expect(filtered({ positions: ["LW", "C", "RW", "D"] })).toHaveLength(skaterCount);
  });

  it("treats no selected positions as All Positions", () => {
    expect(filtered({ positions: [] })).toHaveLength(skaterCount);
  });

  it("combines team with one and with two positions (AND across dimensions)", () => {
    expect(filtered({ team: "MIN", positions: ["LW"] }).map((p) => p.fullName)).toEqual(["Kirill Kaprizov", "Blake Coleman"]);
    expect(filtered({ team: "MIN", positions: ["LW", "D"] }).map((p) => p.fullName)).toEqual(["Kirill Kaprizov", "Brock Faber", "Blake Coleman"]);
    expect(filtered({ team: "MIN", positions: ["C", "RW"] })).toEqual([]);
  });

  it("combines franchise with position", () => {
    const result = filtered({ franchise: "the-offensive-otters", positions: ["C"] });
    expect(result.map((p) => p.fullName)).toContain("Connor Bedard");
    expect(result.every((p) => p.position === "C" && p.previousFranchise.id === "the-offensive-otters")).toBe(true);
  });

  it("combines team, franchise and multiple positions", () => {
    // MIN AND (LW OR RW) AND The Offensive Otters
    expect(filtered({ team: "MIN", positions: ["LW", "RW"], franchise: "the-offensive-otters" }).map((p) => p.fullName)).toEqual([
      "Kirill Kaprizov",
    ]);
    expect(filtered({ team: "MIN", positions: ["LW", "RW"], franchise: "f-u-shoresy" }).map((p) => p.fullName)).toEqual(["Blake Coleman"]);
  });

  it("combines search with filters", () => {
    expect(filtered({ team: "MIN", positions: ["LW"] }, { search: "blake" }).map((p) => p.fullName)).toEqual(["Blake Coleman"]);
  });

  it("returns an empty result for a team with no available players", () => {
    expect(filtered({ team: "PHI" })).toEqual([]);
  });

  it("toggles positions in canonical order and back to All Positions", () => {
    const order = positionsFor("skater");
    let positions = togglePosition([], "RW", order);
    positions = togglePosition(positions, "LW", order);
    expect(positions).toEqual(["LW", "RW"]);
    positions = togglePosition(positions, "LW", order);
    positions = togglePosition(positions, "RW", order);
    expect(positions).toEqual([]);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, positions })).toBe(false);
  });

  it("drops skater positions and skater sort when switching to goalies, keeping search/team/franchise", () => {
    const switched = switchType(
      query({ search: "x", filters: { team: "TBL", positions: ["LW", "RW"], franchise: "weekend-at-beniers" }, sort: { key: "hit", direction: "desc" } }),
      "goalie",
    );
    expect(switched).toEqual({
      type: "goalie",
      search: "x",
      filters: { team: "TBL", positions: [], franchise: "weekend-at-beniers" },
      sort: DEFAULT_SORT,
    });
    expect(switchType(query({ sort: { key: "gp", direction: "desc" } }), "goalie").sort.key).toBe("gp");
  });
});

describe("filter reference lists", () => {
  it("offers all 32 current NHL teams regardless of the pool", () => {
    expect(NHL_TEAMS).toHaveLength(32);
    expect(new Set(NHL_TEAMS.map((t) => t.abbrev)).size).toBe(32);
  });

  it("offers exactly the 10 canonical franchises, without Jet Blue Holiday", () => {
    expect(FRANCHISES.map((f) => f.name)).toEqual([
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
    expect(FRANCHISES.some((f) => /jet blue/i.test(f.name))).toBe(false);
  });
});

describe("pagination", () => {
  const skaters = applyQuery(players, query({ filters: EMPTY_FILTERS }));

  it("offers 10, 20 and 50 rows per page, defaulting to 20", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(paginate(skaters, 1, 20)).toMatchObject({ start: 1, end: 20, page: 1, pageCount: 6, total: 119 });
    expect(paginate(skaters, 2, 20)).toMatchObject({ start: 21, end: 40, page: 2 });
    expect(paginate(skaters, 6, 20)).toMatchObject({ start: 101, end: 119, page: 6 });
    expect(paginate(skaters, 2, 50)).toMatchObject({ start: 51, end: 100, pageCount: 3 });
    expect(paginate(skaters, 12, 10)).toMatchObject({ start: 111, end: 119, pageCount: 12 });
  });

  it("clamps an out-of-range page to a valid one", () => {
    expect(paginate(skaters.slice(0, 3), 9, 8)).toMatchObject({ page: 1, start: 1, end: 3, pageCount: 1 });
    expect(paginate([], 1, 8)).toMatchObject({ page: 1, start: 0, end: 0, pageCount: 1 });
  });
});

describe("formatting", () => {
  it("formats unavailable values as an em dash", () => {
    expect(formatAdp(null)).toBe("—");
    expect(formatSavePct(null)).toBe("—");
  });

  it("formats save percentage without the leading zero", () => {
    expect(formatSavePct(0.912)).toBe(".912");
  });

  it("formats the registry season with full years", () => {
    expect(formatSeasonLong("2026-27")).toBe("2026–2027");
  });

  it("formats snapshot dates without time-zone drift", () => {
    expect(formatDate("2026-09-23")).toBe("Sep 23, 2026");
  });

  it("orders skater profile tiles GP/G/A/PTS then PPP/SOG/HIT/BLK and leaves goalies unchanged", () => {
    expect(tileColumnsFor("skater").map((c) => c.tileLabel)).toEqual(["GP", "G", "A", "PTS", "PPP", "SOG", "HIT", "BLK"]);
    expect(tileColumnsFor("goalie").map((c) => c.tileLabel)).toEqual(["GP", "W", "SV", "SV%"]);
  });

  it("does not include PIM among skater statistics", () => {
    expect(SKATER_COLUMNS.map((c) => c.abbr)).toEqual(["GP", "G", "A", "PTS", "PPP", "SOG", "HIT", "BLK"]);
  });
});

describe("URL view state", () => {
  const view = (overrides: Partial<Omit<ViewState, "query">> & { query?: Partial<PoolQuery> } = {}): ViewState => ({
    ...DEFAULT_VIEW,
    ...overrides,
    query: { ...DEFAULT_VIEW.query, ...overrides.query },
  });

  it("keeps the default view at the bare canonical URL", () => {
    expect(serializeViewState(DEFAULT_VIEW)).toBe("");
    expect(parseViewState("")).toEqual(DEFAULT_VIEW);
  });

  it("round-trips every browse setting", () => {
    const full = view({
      query: {
        type: "skater",
        search: "kap",
        filters: { team: "MIN", positions: ["LW", "RW"], franchise: "the-offensive-otters" },
        sort: { key: "pts", direction: "asc" },
      },
      page: 3,
      pageSize: 50,
      player: "kaprizov",
    });
    const search = serializeViewState(full);
    expect(search).toBe("?q=kap&team=MIN&pos=LW,RW&franchise=the-offensive-otters&sort=pts&dir=asc&page=3&size=50&player=kaprizov");
    expect(parseViewState(search)).toEqual(full);
  });

  it("omits a sort direction that is the column's natural default", () => {
    expect(serializeViewState(view({ query: { sort: { key: "pts", direction: "desc" } } }))).toBe("?sort=pts");
    expect(parseViewState("?sort=pts").query.sort).toEqual({ key: "pts", direction: "desc" });
  });

  it("records the goalie tab and ignores skater-only settings there", () => {
    const parsed = parseViewState("?tab=goalies&pos=LW&sort=hit");
    expect(parsed.query.type).toBe("goalie");
    expect(parsed.query.filters.positions).toEqual([]);
    expect(parsed.query.sort).toEqual(DEFAULT_VIEW.query.sort);
  });

  it("falls back safely on unknown or malformed values", () => {
    const parsed = parseViewState("?team=XYZ&pos=LW,ZZ,lw&franchise=nope&sort=bogus&dir=up&page=-4&size=7");
    expect(parsed.query.filters).toEqual({ team: null, positions: ["LW"], franchise: null });
    expect(parsed.query.sort).toEqual(DEFAULT_VIEW.query.sort);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("maps the obsolete franchise id to the canonical franchise", () => {
    expect(parseViewState("?franchise=jet-blue-holiday").query.filters.franchise).toBe("mccaben-it-real-goes-wrong");
  });
});

describe("filter counts", () => {
  it("counts active filters, one per position", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ team: "MIN", positions: ["LW", "RW"], franchise: "purple-reign" })).toBe(4);
  });

  it("counts each option with the other dimensions kept", () => {
    const counts = facetCounts(players, query(), { team: "MIN", positions: [], franchise: null });
    expect(counts.total).toBe(3);
    expect(counts.position.get("LW")).toBe(2);
    expect(counts.position.get("D")).toBe(1);
    // The team dimension ignores its own selection, so other teams still show their totals.
    expect(counts.allTeams).toBe(119);
    expect(counts.team.get("MIN")).toBe(3);
  });
});
