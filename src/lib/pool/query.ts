import { POSITION_LABELS, SKATER_POSITIONS, type Position } from "./reference";
import { columnsFor, type StatKey } from "./stats";
import type { Player, PlayerType } from "./types";

export type SortKey = "adp" | "name" | StatKey;
export type SortDirection = "asc" | "desc";

export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

/**
 * Filter dimensions combine with AND. Within `positions`, selections combine
 * with OR; an empty list means "All positions" (no positional restriction).
 */
export interface Filters {
  team: string | null;
  positions: Position[];
  franchise: string | null;
}

export interface PoolQuery {
  type: PlayerType;
  search: string;
  filters: Filters;
  sort: Sort;
}

export const DEFAULT_SORT: Sort = { key: "adp", direction: "asc" };
export const EMPTY_FILTERS: Filters = { team: null, positions: [], franchise: null };

/** Rows-per-page choices; the same on every screen size so shared links behave identically. */
export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
export const DEFAULT_PAGE_SIZE = 20;

export function initialQuery(): PoolQuery {
  return { type: "skater", search: "", filters: EMPTY_FILTERS, sort: DEFAULT_SORT };
}

/** The direction a column sorts in when first selected. */
export function defaultDirection(key: SortKey): SortDirection {
  return key === "adp" || key === "name" ? "asc" : "desc";
}

export function sortKeysFor(type: PlayerType): SortKey[] {
  return ["adp", "name", ...columnsFor(type).map((column) => column.key)];
}

export interface SortOption {
  sort: Sort;
  label: string;
}

/** The dedicated mobile sort screen's options, per player type. */
export function sortOptionsFor(type: PlayerType): SortOption[] {
  const byKey: SortKey[] = type === "skater" ? ["adp", "pts", "g", "a", "hit", "blk", "name"] : ["adp", "w", "svPct", "sv", "gp", "name"];
  return byKey.map((key) => {
    const sort = { key, direction: defaultDirection(key) };
    return { sort, label: sortOptionLabel(type, sort) };
  });
}

function sortName(type: PlayerType, key: SortKey): string {
  if (key === "adp") return "Yahoo ADP";
  if (key === "name") return "Player name";
  return columnsFor(type).find((column) => column.key === key)?.label ?? key;
}

/** "Points · High to low" — used on the mobile sort screen. */
export function sortOptionLabel(type: PlayerType, sort: Sort): string {
  return `${sortName(type, sort.key)} · ${directionWords(sort)}`;
}

/** "Yahoo ADP ↑" / "Points high to low" — used in result summaries. */
export function sortSummary(type: PlayerType, sort: Sort): string {
  if (sort.key === "adp") return `Yahoo ADP ${sort.direction === "asc" ? "↑" : "↓"}`;
  return `${sortName(type, sort.key)} ${directionWords(sort).toLowerCase()}`;
}

/** Compact label for the mobile sort control, e.g. "Yahoo ADP ↑". */
export function sortControlLabel(type: PlayerType, sort: Sort): string {
  const arrow = sort.direction === "asc" ? "↑" : "↓";
  if (sort.key === "adp") return `Yahoo ADP ${arrow}`;
  if (sort.key === "name") return `Name ${arrow}`;
  const column = columnsFor(type).find((c) => c.key === sort.key);
  return `${column?.label ?? sort.key} ${arrow}`;
}

function directionWords(sort: Sort): string {
  if (sort.key === "name") return sort.direction === "asc" ? "A to Z" : "Z to A";
  return sort.direction === "asc" ? "Low to high" : "High to low";
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function searchText(player: Player): string {
  return normalize(
    [
      player.fullName,
      player.nhlTeam?.name ?? "",
      player.nhlTeam?.abbrev ?? "",
      player.position,
      POSITION_LABELS[player.position],
    ].join(" "),
  );
}

export function matchesSearch(player: Player, search: string): boolean {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = searchText(player);
  return terms.every((term) => haystack.includes(term));
}

export function matchesFilters(player: Player, filters: Filters): boolean {
  if (filters.team !== null && player.nhlTeam?.abbrev !== filters.team) return false;
  if (filters.positions.length > 0 && !filters.positions.includes(player.position)) return false;
  if (filters.franchise !== null && player.previousFranchise.id !== filters.franchise) return false;
  return true;
}

function sortValue(player: Player, key: SortKey): number | string | null {
  if (key === "adp") return player.adp;
  if (key === "name") return `${normalize(player.lastName)} ${normalize(player.firstName)}`;
  return (player.stats as unknown as Record<string, number | null>)[key] ?? null;
}

/** Sorts a copy. Unavailable (null) values always sort last, in either direction. */
export function sortPlayers(players: readonly Player[], sort: Sort): Player[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...players].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    if (av !== null && bv !== null && av !== bv) {
      const compared = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
      if (compared !== 0) return compared * factor;
    }
    // Stable, deterministic tie-break: ADP (nulls last), then name.
    if (sort.key !== "adp" && a.adp !== b.adp) {
      if (a.adp === null) return 1;
      if (b.adp === null) return -1;
      return a.adp - b.adp;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

export function applyQuery(players: readonly Player[], query: PoolQuery): Player[] {
  const matching = players.filter(
    (player) => player.type === query.type && matchesSearch(player, query.search) && matchesFilters(player, query.filters),
  );
  return sortPlayers(matching, query.sort);
}

export function countOfType(players: readonly Player[], type: PlayerType): number {
  return players.filter((player) => player.type === type).length;
}

/** Switches player type, keeping search/team/franchise and dropping anything invalid for the new type. */
export function switchType(query: PoolQuery, type: PlayerType): PoolQuery {
  if (type === query.type) return query;
  const valid = positionsFor(type);
  const sortValid = sortKeysFor(type).includes(query.sort.key);
  return {
    type,
    search: query.search,
    filters: { ...query.filters, positions: query.filters.positions.filter((position) => valid.includes(position)) },
    sort: sortValid ? query.sort : DEFAULT_SORT,
  };
}

export function positionsFor(type: PlayerType): Position[] {
  return type === "goalie" ? ["G"] : [...SKATER_POSITIONS];
}

/** Toggles one position in a multi-select, keeping the canonical LW, C, RW, D order. */
export function togglePosition(positions: readonly Position[], position: Position, order: readonly Position[]): Position[] {
  const next = positions.includes(position) ? positions.filter((p) => p !== position) : [...positions, position];
  return order.filter((p) => next.includes(p));
}

export function activeFilterCount(filters: Filters): number {
  return (filters.team ? 1 : 0) + filters.positions.length + (filters.franchise ? 1 : 0);
}

/**
 * How many players each option would return, keeping the other dimensions
 * (and search) as they are: counts for a dimension ignore that dimension's own
 * selection, so a reader can see what switching would give.
 */
export function facetCounts(players: readonly Player[], query: PoolQuery, filters: Filters) {
  const base = players.filter((player) => player.type === query.type && matchesSearch(player, query.search));
  const count = (f: Filters) => base.filter((player) => matchesFilters(player, f)).length;
  const team = new Map<string, number>();
  const position = new Map<string, number>();
  const franchise = new Map<string, number>();
  const byTeam = base.filter((player) => matchesFilters(player, { ...filters, team: null }));
  for (const player of byTeam) if (player.nhlTeam) team.set(player.nhlTeam.abbrev, (team.get(player.nhlTeam.abbrev) ?? 0) + 1);
  const byPosition = base.filter((player) => matchesFilters(player, { ...filters, positions: [] }));
  for (const player of byPosition) position.set(player.position, (position.get(player.position) ?? 0) + 1);
  const byFranchise = base.filter((player) => matchesFilters(player, { ...filters, franchise: null }));
  for (const player of byFranchise) franchise.set(player.previousFranchise.id, (franchise.get(player.previousFranchise.id) ?? 0) + 1);
  return {
    team,
    position,
    franchise,
    allTeams: byTeam.length,
    allPositions: byPosition.length,
    allFranchises: byFranchise.length,
    total: count(filters),
  };
}

export function hasActiveFilters(filters: Filters): boolean {
  return filters.team !== null || filters.positions.length > 0 || filters.franchise !== null;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  /** 1-based index of the first item on the page (0 when empty). */
  start: number;
  end: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const offset = (current - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize);
  return {
    items: pageItems,
    page: current,
    pageCount,
    start: total === 0 ? 0 : offset + 1,
    end: offset + pageItems.length,
    total,
  };
}
