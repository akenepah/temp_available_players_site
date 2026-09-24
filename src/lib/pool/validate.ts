import {
  FRANCHISES,
  REASON_LABELS,
  getNhlTeam,
  resolveFranchise,
  type Position,
  type ReasonAvailable,
} from "./reference";
import type { GoalieStats, Player, PoolSnapshot, SkaterStats } from "./types";

/**
 * Parses the raw snapshot JSON (see docs/DATA.md for the contract) into
 * display-ready records. Invalid input is rejected as a whole rather than
 * silently dropping players: a malformed record must surface as an error,
 * never as a smaller pool.
 */

export class SnapshotValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid player pool snapshot:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "SnapshotValidationError";
  }
}

type Json = Record<string, unknown>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const POSITIONS: readonly Position[] = ["C", "LW", "RW", "D", "G"];
const SKATER_STAT_KEYS = ["gp", "g", "a", "pts", "ppp", "sog", "hit", "blk"] as const;
const GOALIE_STAT_KEYS = ["gp", "w", "sv", "svPct"] as const;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSnapshot(input: unknown): PoolSnapshot {
  const issues: string[] = [];
  const issue = (path: string, message: string) => issues.push(`${path}: ${message}`);

  if (!isObject(input)) throw new SnapshotValidationError(["snapshot: expected an object"]);

  const str = (obj: Json, key: string, path: string): string => {
    const value = obj[key];
    if (typeof value !== "string" || value.trim() === "") {
      issue(`${path}.${key}`, "expected a non-empty string");
      return "";
    }
    return value.trim();
  };
  const date = (obj: Json, key: string, path: string): string => {
    const value = str(obj, key, path);
    if (value !== "" && (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value)))) {
      issue(`${path}.${key}`, "expected an ISO date (YYYY-MM-DD)");
    }
    return value;
  };
  const count = (obj: Json, key: string, path: string): number => {
    const value = obj[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      issue(`${path}.${key}`, "expected a non-negative integer");
      return 0;
    }
    return value;
  };
  const nullableNumber = (obj: Json, key: string, path: string): number | null => {
    const value = obj[key];
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      issue(`${path}.${key}`, "expected a non-negative number or null");
      return null;
    }
    return value;
  };

  if (input.schemaVersion !== 1) issue("schemaVersion", "expected 1");

  const draftSeason = str(input, "draftSeason", "snapshot");
  const statsSeason = str(input, "statsSeason", "snapshot");
  const updatedAt = date(input, "updatedAt", "snapshot");
  const adpCheckedAt = date(input, "adpCheckedAt", "snapshot");

  let keeperDecisions = { completed: 0, total: 0 };
  if (isObject(input.keeperDecisions)) {
    keeperDecisions = {
      completed: count(input.keeperDecisions, "completed", "keeperDecisions"),
      total: count(input.keeperDecisions, "total", "keeperDecisions"),
    };
    if (keeperDecisions.completed > keeperDecisions.total) {
      issue("keeperDecisions", "completed cannot exceed total");
    }
  } else {
    issue("keeperDecisions", "expected an object");
  }

  let commissionerSelection: PoolSnapshot["commissionerSelection"] = null;
  if (isObject(input.commissionerSelection)) {
    const selection = input.commissionerSelection;
    const franchise = resolveFranchise(str(selection, "franchiseId", "commissionerSelection"));
    if (!franchise) issue("commissionerSelection.franchiseId", "unknown franchise");
    const returnCount = count(selection, "returnCount", "commissionerSelection");
    if (franchise) commissionerSelection = { franchise, returnCount };
  } else if (input.commissionerSelection !== null) {
    issue("commissionerSelection", "expected an object or null");
  }

  const players: Player[] = [];
  const seenIds = new Set<string>();
  if (!Array.isArray(input.players)) {
    issue("players", "expected an array");
  } else {
    input.players.forEach((raw: unknown, index) => {
      const path = `players[${index}]`;
      if (!isObject(raw)) {
        issue(path, "expected an object");
        return;
      }
      const id = str(raw, "id", path);
      if (id !== "" && seenIds.has(id)) issue(`${path}.id`, `duplicate id "${id}"`);
      seenIds.add(id);

      const firstName = str(raw, "firstName", path);
      const lastName = str(raw, "lastName", path);

      const position = raw.position as Position;
      if (!POSITIONS.includes(position)) issue(`${path}.position`, `expected one of ${POSITIONS.join(", ")}`);

      let nhlTeam = null;
      if (raw.nhlTeam !== null && raw.nhlTeam !== undefined) {
        nhlTeam = typeof raw.nhlTeam === "string" ? getNhlTeam(raw.nhlTeam) : null;
        if (!nhlTeam) issue(`${path}.nhlTeam`, "expected an NHL team abbreviation or null");
      }

      const franchiseId = str(raw, "previousFranchiseId", path);
      const previousFranchise = resolveFranchise(franchiseId);
      if (franchiseId !== "" && !previousFranchise) {
        issue(`${path}.previousFranchiseId`, `unknown franchise; expected one of ${FRANCHISES.map((f) => f.id).join(", ")}`);
      }

      const reasonAvailable = raw.reasonAvailable as ReasonAvailable;
      if (!(reasonAvailable in REASON_LABELS)) {
        issue(`${path}.reasonAvailable`, `expected one of ${Object.keys(REASON_LABELS).join(", ")}`);
      }

      const nhlPlayerId = nullableNumber(raw, "nhlPlayerId", path);
      const adp = nullableNumber(raw, "adp", path);

      let portraitUrl: string | null = null;
      if (raw.portraitUrl !== null && raw.portraitUrl !== undefined) {
        if (typeof raw.portraitUrl === "string" && /^(https:\/\/|\/)/.test(raw.portraitUrl)) {
          portraitUrl = raw.portraitUrl;
        } else {
          issue(`${path}.portraitUrl`, "expected an https:// or site-relative URL, or null");
        }
      }

      if (!isObject(raw.stats)) {
        issue(`${path}.stats`, "expected an object");
        return;
      }
      const statsRaw = raw.stats;
      const base = {
        id,
        nhlPlayerId,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        position,
        nhlTeam,
        reasonAvailable,
        adp,
        portraitUrl,
      };
      if (!previousFranchise) return;

      if (position === "G") {
        const stats = Object.fromEntries(
          GOALIE_STAT_KEYS.map((key) => [key, nullableNumber(statsRaw, key, `${path}.stats`)]),
        ) as unknown as GoalieStats;
        if (stats.svPct !== null && stats.svPct > 1) issue(`${path}.stats.svPct`, "expected a fraction, e.g. 0.912");
        players.push({ ...base, type: "goalie", previousFranchise, stats });
      } else {
        const stats = Object.fromEntries(
          SKATER_STAT_KEYS.map((key) => [key, nullableNumber(statsRaw, key, `${path}.stats`)]),
        ) as unknown as SkaterStats;
        players.push({ ...base, type: "skater", previousFranchise, stats });
      }
    });
  }

  if (issues.length > 0) throw new SnapshotValidationError(issues);

  return {
    schemaVersion: 1,
    draftSeason,
    statsSeason,
    updatedAt,
    adpCheckedAt,
    keeperDecisions,
    commissionerSelection,
    players,
  };
}
