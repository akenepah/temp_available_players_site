/**
 * League and NHL reference data used to label snapshot records.
 *
 * This is reference data only (team names, franchise display names,
 * position labels) — never player data. Player records live exclusively in
 * the committed snapshot (see docs/DATA.md).
 */

export type SkaterPosition = "C" | "LW" | "RW" | "D";
export type Position = SkaterPosition | "G";

export const SKATER_POSITIONS: readonly SkaterPosition[] = ["LW", "C", "RW", "D"];

export const POSITION_LABELS: Record<Position, string> = {
  LW: "Left wing",
  C: "Centre",
  RW: "Right wing",
  D: "Defense",
  G: "Goalie",
};

export interface NhlTeam {
  abbrev: string;
  name: string;
  /** Short label used in chips and summaries, e.g. "Minnesota". */
  shortName: string;
}

export const NHL_TEAMS: readonly NhlTeam[] = [
  { abbrev: "ANA", name: "Anaheim Ducks", shortName: "Anaheim" },
  { abbrev: "BOS", name: "Boston Bruins", shortName: "Boston" },
  { abbrev: "BUF", name: "Buffalo Sabres", shortName: "Buffalo" },
  { abbrev: "CGY", name: "Calgary Flames", shortName: "Calgary" },
  { abbrev: "CAR", name: "Carolina Hurricanes", shortName: "Carolina" },
  { abbrev: "CHI", name: "Chicago Blackhawks", shortName: "Chicago" },
  { abbrev: "COL", name: "Colorado Avalanche", shortName: "Colorado" },
  { abbrev: "CBJ", name: "Columbus Blue Jackets", shortName: "Columbus" },
  { abbrev: "DAL", name: "Dallas Stars", shortName: "Dallas" },
  { abbrev: "DET", name: "Detroit Red Wings", shortName: "Detroit" },
  { abbrev: "EDM", name: "Edmonton Oilers", shortName: "Edmonton" },
  { abbrev: "FLA", name: "Florida Panthers", shortName: "Florida" },
  { abbrev: "LAK", name: "Los Angeles Kings", shortName: "Los Angeles" },
  { abbrev: "MIN", name: "Minnesota Wild", shortName: "Minnesota" },
  { abbrev: "MTL", name: "Montréal Canadiens", shortName: "Montréal" },
  { abbrev: "NSH", name: "Nashville Predators", shortName: "Nashville" },
  { abbrev: "NJD", name: "New Jersey Devils", shortName: "New Jersey" },
  { abbrev: "NYI", name: "New York Islanders", shortName: "NY Islanders" },
  { abbrev: "NYR", name: "New York Rangers", shortName: "NY Rangers" },
  { abbrev: "OTT", name: "Ottawa Senators", shortName: "Ottawa" },
  { abbrev: "PHI", name: "Philadelphia Flyers", shortName: "Philadelphia" },
  { abbrev: "PIT", name: "Pittsburgh Penguins", shortName: "Pittsburgh" },
  { abbrev: "SJS", name: "San Jose Sharks", shortName: "San Jose" },
  { abbrev: "SEA", name: "Seattle Kraken", shortName: "Seattle" },
  { abbrev: "STL", name: "St. Louis Blues", shortName: "St. Louis" },
  { abbrev: "TBL", name: "Tampa Bay Lightning", shortName: "Tampa Bay" },
  { abbrev: "TOR", name: "Toronto Maple Leafs", shortName: "Toronto" },
  { abbrev: "UTA", name: "Utah Mammoth", shortName: "Utah" },
  { abbrev: "VAN", name: "Vancouver Canucks", shortName: "Vancouver" },
  { abbrev: "VGK", name: "Vegas Golden Knights", shortName: "Vegas" },
  { abbrev: "WSH", name: "Washington Capitals", shortName: "Washington" },
  { abbrev: "WPG", name: "Winnipeg Jets", shortName: "Winnipeg" },
];

const NHL_TEAMS_BY_ABBREV = new Map(NHL_TEAMS.map((team) => [team.abbrev, team]));

export function getNhlTeam(abbrev: string | null): NhlTeam | null {
  if (abbrev === null) return null;
  return NHL_TEAMS_BY_ABBREV.get(abbrev) ?? null;
}

/** Official NHL team mark, served unaltered from the NHL asset CDN. */
export function nhlTeamLogoUrl(abbrev: string): string {
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
}

export interface Franchise {
  id: string;
  /** Canonical current franchise name. */
  name: string;
}

/**
 * Canonical current Farm to Fame franchise names. Ids match the main
 * portal's `team_franchises.slug` values except where a franchise has since
 * been renamed (see FRANCHISE_ALIASES).
 */
export const FRANCHISES: readonly Franchise[] = [
  { id: "bestial-backwoods-delight", name: "Bestial Backwoods Delight" },
  { id: "f-u-shoresy", name: "F U Shoresy" },
  { id: "if-it-makes-you-saad", name: "If It Makes You Saad" },
  { id: "joshs-team", name: "Josh’s Team" },
  { id: "mccaben-it-real-goes-wrong", name: "McCabe'n It Real Goes Wrong" },
  { id: "purple-reign", name: "Purple Reign" },
  { id: "stache-ing-ginos", name: "Stache-ing Ginos" },
  { id: "the-offensive-otters", name: "The Offensive Otters" },
  { id: "timbitches", name: "Timbitches" },
  { id: "weekend-at-beniers", name: "Weekend At Beniers" },
];

/**
 * Obsolete franchise ids that a snapshot export may still carry. They
 * resolve to the canonical current franchise so a historical name is never
 * displayed.
 */
export const FRANCHISE_ALIASES: Record<string, string> = {
  "jet-blue-holiday": "mccaben-it-real-goes-wrong",
};

const FRANCHISES_BY_ID = new Map(FRANCHISES.map((franchise) => [franchise.id, franchise]));

export function resolveFranchise(id: string): Franchise | null {
  return FRANCHISES_BY_ID.get(FRANCHISE_ALIASES[id] ?? id) ?? null;
}

export type ReasonAvailable = "contract_expired" | "released";

export const REASON_LABELS: Record<ReasonAvailable, string> = {
  contract_expired: "Contract expired",
  released: "Released",
};
