import { describe, expect, it } from "vitest";
import { FIXTURE_SNAPSHOT } from "../../../tests/fixtures/pool";
import { formatAdp, formatDate, formatSavePct } from "./format";
import {
  applyQuery,
  DEFAULT_SORT,
  DESKTOP_PAGE_SIZE,
  EMPTY_FILTERS,
  initialQuery,
  MOBILE_PAGE_SIZE,
  paginate,
  sortOptionsFor,
  sortPlayers,
  switchType,
  type PoolQuery,
} from "./query";
import { SKATER_COLUMNS } from "./stats";
import { parseSnapshot, SnapshotValidationError } from "./validate";

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

  it("combines team, position and franchise filters with search", () => {
    const filtered = applyQuery(players, query({ filters: { team: "MIN", position: "LW", franchise: null } }));
    expect(filtered.map((p) => p.fullName)).toEqual(["Kirill Kaprizov", "Blake Coleman"]);
    const narrowed = applyQuery(players, query({ search: "blake", filters: { team: "MIN", position: "LW", franchise: null } }));
    expect(narrowed.map((p) => p.fullName)).toEqual(["Blake Coleman"]);
    const withFranchise = applyQuery(players, query({ filters: { team: "MIN", position: "LW", franchise: "f-u-shoresy" } }));
    expect(withFranchise.map((p) => p.fullName)).toEqual(["Blake Coleman"]);
  });

  it("drops a skater position and skater sort when switching to goalies, keeping search/team/franchise", () => {
    const switched = switchType(
      query({ search: "x", filters: { team: "TBL", position: "LW", franchise: "weekend-at-beniers" }, sort: { key: "hit", direction: "desc" } }),
      "goalie",
    );
    expect(switched).toEqual({
      type: "goalie",
      search: "x",
      filters: { team: "TBL", position: null, franchise: "weekend-at-beniers" },
      sort: DEFAULT_SORT,
    });
    expect(switchType(query({ sort: { key: "gp", direction: "desc" } }), "goalie").sort.key).toBe("gp");
  });
});

describe("pagination", () => {
  const skaters = applyQuery(players, query({ filters: EMPTY_FILTERS }));

  it("pages desktop results 8 at a time", () => {
    expect(DESKTOP_PAGE_SIZE).toBe(8);
    expect(paginate(skaters, 1, 8)).toMatchObject({ start: 1, end: 8, page: 1, pageCount: 15, total: 119 });
    expect(paginate(skaters, 2, 8)).toMatchObject({ start: 9, end: 16, page: 2 });
    expect(paginate(skaters, 15, 8)).toMatchObject({ start: 113, end: 119, page: 15 });
  });

  it("pages mobile results 6 at a time", () => {
    expect(MOBILE_PAGE_SIZE).toBe(6);
    expect(paginate(skaters, 2, 6)).toMatchObject({ start: 7, end: 12, page: 2, pageCount: 20 });
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

  it("formats snapshot dates without time-zone drift", () => {
    expect(formatDate("2026-09-23")).toBe("Sep 23, 2026");
  });

  it("does not include PIM among skater statistics", () => {
    expect(SKATER_COLUMNS.map((c) => c.abbr)).toEqual(["GP", "G", "A", "PTS", "PPP", "SOG", "HIT", "BLK"]);
  });
});
