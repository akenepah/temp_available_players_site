import type { Franchise, NhlTeam, Position, ReasonAvailable } from "./reference";

export type PlayerType = "skater" | "goalie";

/** 2025–26 NHL regular-season actuals. `null` means unavailable, never zero. */
export interface SkaterStats {
  gp: number | null;
  g: number | null;
  a: number | null;
  pts: number | null;
  ppp: number | null;
  sog: number | null;
  hit: number | null;
  blk: number | null;
}

export interface GoalieStats {
  gp: number | null;
  w: number | null;
  sv: number | null;
  /** Save percentage as a fraction, e.g. 0.912. */
  svPct: number | null;
}

interface PlayerBase {
  id: string;
  nhlPlayerId: number | null;
  firstName: string;
  lastName: string;
  fullName: string;
  position: Position;
  /** Null when the player has no current NHL team. */
  nhlTeam: NhlTeam | null;
  previousFranchise: Franchise;
  reasonAvailable: ReasonAvailable;
  /** Yahoo ADP. Null when unavailable. */
  adp: number | null;
  portraitUrl: string | null;
}

export interface Skater extends PlayerBase {
  type: "skater";
  stats: SkaterStats;
}

export interface Goalie extends PlayerBase {
  type: "goalie";
  stats: GoalieStats;
}

export type Player = Skater | Goalie;

export interface CommissionerSelection {
  franchise: Franchise;
  /** Number of that franchise's players returned to the pool. */
  returnCount: number;
}

export interface PoolSnapshot {
  schemaVersion: 1;
  /** Draft the pool feeds, e.g. "2026-27". */
  draftSeason: string;
  /** Season the actual statistics cover, e.g. "2025-26". */
  statsSeason: string;
  /** ISO date (YYYY-MM-DD) the snapshot was published. */
  updatedAt: string;
  /** ISO date (YYYY-MM-DD) Yahoo ADP was last checked. */
  adpCheckedAt: string;
  keeperDecisions: { completed: number; total: number };
  commissionerSelection: CommissionerSelection | null;
  players: Player[];
}
