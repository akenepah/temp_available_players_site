import { FRANCHISES, NHL_TEAMS, resolveFranchise, type Position } from "./reference";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT, EMPTY_FILTERS, PAGE_SIZE_OPTIONS, defaultDirection, initialQuery, positionsFor, sortKeysFor, type PoolQuery, type SortKey } from "./query";
import type { PlayerType } from "./types";

/**
 * Everything a reader can change while browsing, as it appears in the URL.
 * Defaults are omitted, so the untouched page stays at the canonical `/`.
 *
 *   ?tab=goalies&q=kane&team=MIN&pos=LW,RW&franchise=purple-reign
 *    &sort=pts&dir=asc&page=2&size=50&player=kirill-kaprizov
 */
export interface ViewState {
  query: PoolQuery;
  page: number;
  pageSize: number;
  /** Stable player id from the snapshot, or null when no profile is open. */
  player: string | null;
}

export const DEFAULT_VIEW: ViewState = { query: initialQuery(), page: 1, pageSize: DEFAULT_PAGE_SIZE, player: null };

const TEAM_ABBREVS = new Set(NHL_TEAMS.map((team) => team.abbrev));

/** Reads a query string into a valid view; anything unknown or malformed falls back to its default. */
export function parseViewState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const type: PlayerType = params.get("tab") === "goalies" ? "goalie" : "skater";

  const team = params.get("team")?.toUpperCase() ?? null;
  const franchise = resolveFranchise(params.get("franchise") ?? "")?.id ?? null;
  const valid = positionsFor(type);
  const positions = [
    ...new Set(
      (params.get("pos") ?? "")
        .split(",")
        .map((p) => p.trim().toUpperCase())
        .filter((p): p is Position => (valid as string[]).includes(p)),
    ),
  ];
  const orderedPositions = type === "goalie" ? [] : valid.filter((p) => positions.includes(p));

  const sortKey = params.get("sort") as SortKey | null;
  const key = sortKey && sortKeysFor(type).includes(sortKey) ? sortKey : DEFAULT_SORT.key;
  const dirParam = params.get("dir");
  const direction = dirParam === "asc" || dirParam === "desc" ? dirParam : defaultDirection(key);

  const pageParam = Number(params.get("page"));
  const sizeParam = Number(params.get("size"));

  return {
    query: {
      type,
      search: params.get("q") ?? "",
      filters: {
        ...EMPTY_FILTERS,
        team: team && TEAM_ABBREVS.has(team) ? team : null,
        positions: orderedPositions,
        franchise,
      },
      sort: { key, direction },
    },
    page: Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE,
    player: params.get("player") || null,
  };
}

/** Writes a view as a query string ("" for the default view), in a stable parameter order. */
export function serializeViewState(view: ViewState): string {
  const { query } = view;
  const params = new URLSearchParams();
  if (query.type === "goalie") params.set("tab", "goalies");
  if (query.search) params.set("q", query.search);
  if (query.filters.team) params.set("team", query.filters.team);
  if (query.filters.positions.length > 0) params.set("pos", query.filters.positions.join(","));
  if (query.filters.franchise && FRANCHISES.some((f) => f.id === query.filters.franchise)) params.set("franchise", query.filters.franchise);
  if (query.sort.key !== DEFAULT_SORT.key) params.set("sort", query.sort.key);
  if (query.sort.direction !== defaultDirection(query.sort.key)) params.set("dir", query.sort.direction);
  if (view.page > 1) params.set("page", String(view.page));
  if (view.pageSize !== DEFAULT_PAGE_SIZE) params.set("size", String(view.pageSize));
  if (view.player) params.set("player", view.player);
  const text = params.toString().replace(/%2C/g, ",");
  return text ? `?${text}` : "";
}
