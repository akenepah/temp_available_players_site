/**
 * TEST FIXTURE — NOT REAL POOL DATA.
 *
 * Used only by unit/e2e tests and local visual QA. The named players and
 * numbers are transcribed from the approved design exports so the UI can be
 * compared against them; the "Fixture Skater/Goalie" filler rows are
 * synthetic and exist only to reach the reference composition
 * (119 skaters + 23 goalies = 142). Never copy this into public/data/.
 */

type RawStats = Record<string, number | null>;

export interface RawPlayer {
  id: string;
  nhlPlayerId: number | null;
  firstName: string;
  lastName: string;
  position: "C" | "LW" | "RW" | "D" | "G";
  nhlTeam: string | null;
  previousFranchiseId: string;
  reasonAvailable: "contract_expired" | "released";
  adp: number | null;
  portraitUrl: string | null;
  stats: RawStats;
}

const mug = (team: string, id: number) => `https://assets.nhle.com/mugs/nhl/20262027/${team}/${id}.png`;

function skater(
  id: string,
  nhlPlayerId: number | null,
  first: string,
  last: string,
  position: "C" | "LW" | "RW" | "D",
  team: string | null,
  franchise: string,
  adp: number | null,
  [gp, g, a, pts, ppp, sog, hit, blk]: (number | null)[],
  options: { portrait?: boolean; reason?: RawPlayer["reasonAvailable"] } = {},
): RawPlayer {
  return {
    id,
    nhlPlayerId,
    firstName: first,
    lastName: last,
    position,
    nhlTeam: team,
    previousFranchiseId: franchise,
    reasonAvailable: options.reason ?? "contract_expired",
    adp,
    portraitUrl: options.portrait && nhlPlayerId && team ? mug(team, nhlPlayerId) : null,
    stats: { gp: gp ?? null, g: g ?? null, a: a ?? null, pts: pts ?? null, ppp: ppp ?? null, sog: sog ?? null, hit: hit ?? null, blk: blk ?? null },
  };
}

function goalie(
  id: string,
  nhlPlayerId: number | null,
  first: string,
  last: string,
  team: string | null,
  franchise: string,
  adp: number | null,
  [gp, w, sv, svPct]: (number | null)[],
  options: { portrait?: boolean } = {},
): RawPlayer {
  return {
    id,
    nhlPlayerId,
    firstName: first,
    lastName: last,
    position: "G",
    nhlTeam: team,
    previousFranchiseId: franchise,
    reasonAvailable: "contract_expired",
    adp,
    portraitUrl: options.portrait && nhlPlayerId && team ? mug(team, nhlPlayerId) : null,
    stats: { gp: gp ?? null, w: w ?? null, sv: sv ?? null, svPct: svPct ?? null },
  };
}

const named: RawPlayer[] = [
  skater("kaprizov", 8478864, "Kirill", "Kaprizov", "LW", "MIN", "the-offensive-otters", 8, [78, 45, 44, 89, 32, 269, 52, 27], { portrait: true }),
  skater("necas", 8480039, "Martin", "Necas", "C", "COL", "purple-reign", 14, [78, 38, 62, 100, 24, 206, 85, 26], { portrait: true }),
  skater("johnston", 8482740, "Wyatt", "Johnston", "C", "DAL", "stache-ing-ginos", 18, [82, 45, 41, 86, 42, 206, 56, 55], { portrait: true }),
  skater("debrincat", 8479337, "Alex", "DeBrincat", "RW", "DET", "if-it-makes-you-saad", 38, [82, 41, 44, 85, 23, 287, 38, 39], { portrait: true }),
  skater("stutzle", 8482116, "Tim", "Stützle", "C", "OTT", "if-it-makes-you-saad", 46, [80, 34, 49, 83, 29, 194, 126, 44], { portrait: true }),
  skater("marchenko", null, "Kirill", "Marchenko", "RW", "CBJ", "weekend-at-beniers", 60, [76, 27, 40, 67, 23, 218, 61, 40]),
  skater("bedard", 8484144, "Connor", "Bedard", "C", "CHI", "the-offensive-otters", 61, [69, 30, 45, 75, 21, 226, 31, 27], { portrait: true }),
  skater("heiskanen", 8480036, "Miro", "Heiskanen", "D", "DAL", "stache-ing-ginos", 66, [77, 9, 54, 63, 28, 148, 21, 132], { portrait: true }),
  skater("raymond", null, "Lucas", "Raymond", "LW", "DET", "the-offensive-otters", 68, [80, 25, 51, 76, 27, 173, 43, 29]),
  skater("faber", null, "Brock", "Faber", "D", "MIN", "if-it-makes-you-saad", 77, [80, 15, 36, 51, 11, 173, 33, 148]),
  skater("zibanejad", null, "Mika", "Zibanejad", "C", "NYR", "purple-reign", 84, [81, 34, 44, 78, 35, 215, 105, 50]),
  skater("coleman", null, "Blake", "Coleman", "LW", "MIN", "f-u-shoresy", null, [69, 20, 15, 35, 1, 176, 152, 48]),
  skater("kane", null, "Evander", "Kane", "LW", null, "jet-blue-holiday", null, [null, null, null, null, null, null, null, null], { reason: "released" }),
  goalie("vasilevskiy", 8476883, "Andrei", "Vasilevskiy", "TBL", "weekend-at-beniers", 10, [58, 39, 1353, 0.912], { portrait: true }),
  goalie("thompson", null, "Logan", "Thompson", "WSH", "if-it-makes-you-saad", 29, [58, 31, 1447, 0.912]),
];

const TEAMS = ["BOS", "TOR", "EDM", "VAN", "PIT", "NJD", "FLA", "SEA", "WPG", "UTA", "STL", "NSH", "CAR", "LAK", "VGK"];
const FRANCHISES = [
  "bestial-backwoods-delight",
  "f-u-shoresy",
  "if-it-makes-you-saad",
  "joshs-team",
  "purple-reign",
  "stache-ing-ginos",
  "the-offensive-otters",
  "timbitches",
  "weekend-at-beniers",
];
const POSITIONS = ["C", "LW", "RW", "D"] as const;

function filler(): RawPlayer[] {
  const rows: RawPlayer[] = [];
  const namedSkaters = named.filter((p) => p.position !== "G").length;
  for (let i = 1; rows.length < 119 - namedSkaters; i++) {
    const n = String(i).padStart(2, "0");
    rows.push(
      skater(
        `fixture-skater-${n}`,
        null,
        "Fixture",
        `Skater ${n}`,
        POSITIONS[i % 4]!,
        TEAMS[i % TEAMS.length]!,
        FRANCHISES[i % FRANCHISES.length]!,
        i % 9 === 0 ? null : 90 + i * 2,
        [60 + (i % 22), i % 30, (i * 3) % 40, (i % 30) + ((i * 3) % 40), i % 15, 90 + ((i * 7) % 180), (i * 11) % 200, (i * 5) % 120],
      ),
    );
  }
  const namedGoalies = named.filter((p) => p.position === "G").length;
  for (let i = 1; i <= 23 - namedGoalies; i++) {
    const n = String(i).padStart(2, "0");
    rows.push(
      goalie(`fixture-goalie-${n}`, null, "Fixture", `Goalie ${n}`, TEAMS[i % TEAMS.length]!, FRANCHISES[i % FRANCHISES.length]!, i % 7 === 0 ? null : 40 + i * 3, [
        20 + i,
        8 + (i % 20),
        500 + i * 37,
        0.88 + (i % 30) / 1000,
      ]),
    );
  }
  return rows;
}

export const FIXTURE_SNAPSHOT = {
  schemaVersion: 1,
  draftSeason: "2026-27",
  statsSeason: "2025-26",
  updatedAt: "2026-09-23",
  adpCheckedAt: "2026-09-23",
  keeperDecisions: { completed: 10, total: 10 },
  commissionerSelection: { franchiseId: "purple-reign", returnCount: 15 },
  players: [...named, ...filler()],
};
