import { formatCount, formatSavePct } from "./format";
import type { GoalieStats, PlayerType, SkaterStats } from "./types";

export type SkaterStatKey = keyof SkaterStats;
export type GoalieStatKey = keyof GoalieStats;
export type StatKey = SkaterStatKey | GoalieStatKey;

export interface StatColumn<K extends StatKey = StatKey> {
  key: K;
  /** Column header, e.g. "PTS". */
  abbr: string;
  /** Profile tile label, e.g. "GOALS". */
  tileLabel: string;
  /** Full label for the focused Stats view and sort options. */
  label: string;
  format: (value: number | null) => string;
}

/** Desktop/mobile table order. PIM is intentionally not part of this registry. */
export const SKATER_COLUMNS: readonly StatColumn<SkaterStatKey>[] = [
  { key: "gp", abbr: "GP", tileLabel: "GP", label: "Games played", format: formatCount },
  { key: "g", abbr: "G", tileLabel: "G", label: "Goals", format: formatCount },
  { key: "a", abbr: "A", tileLabel: "A", label: "Assists", format: formatCount },
  { key: "pts", abbr: "PTS", tileLabel: "PTS", label: "Points", format: formatCount },
  { key: "ppp", abbr: "PPP", tileLabel: "PPP", label: "Power-play points", format: formatCount },
  { key: "sog", abbr: "SOG", tileLabel: "SOG", label: "Shots on goal", format: formatCount },
  { key: "hit", abbr: "HIT", tileLabel: "HIT", label: "Hits", format: formatCount },
  { key: "blk", abbr: "BLK", tileLabel: "BLK", label: "Blocks", format: formatCount },
];

export const GOALIE_COLUMNS: readonly StatColumn<GoalieStatKey>[] = [
  { key: "gp", abbr: "GP", tileLabel: "GP", label: "Games played", format: formatCount },
  { key: "w", abbr: "W", tileLabel: "W", label: "Wins", format: formatCount },
  { key: "sv", abbr: "SV", tileLabel: "SV", label: "Saves", format: formatCount },
  { key: "svPct", abbr: "SV%", tileLabel: "SV%", label: "Save percentage", format: formatSavePct },
];

export function columnsFor(type: PlayerType): readonly StatColumn[] {
  return type === "skater" ? SKATER_COLUMNS : GOALIE_COLUMNS;
}

/** Profile Overview tiles: skaters read GP · G · A · PTS, then PPP · SOG · HIT · BLK (the table order). */
export function tileColumnsFor(type: PlayerType): readonly StatColumn[] {
  return type === "goalie" ? GOALIE_COLUMNS : SKATER_COLUMNS;
}
