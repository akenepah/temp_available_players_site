"use client";

import { useCallback, useMemo, useState } from "react";
import { formatSeason } from "@/lib/pool/format";
import { SITE } from "@/lib/site";
import { usePoolSnapshot } from "@/lib/pool/load";
import {
  applyQuery,
  DEFAULT_SORT,
  DESKTOP_PAGE_SIZE,
  EMPTY_FILTERS,
  hasActiveFilters,
  initialQuery,
  MOBILE_PAGE_SIZE,
  paginate,
  sortSummary,
  switchType,
  type Filters,
  type PoolQuery,
  type Sort,
} from "@/lib/pool/query";
import type { Player, PlayerType } from "@/lib/pool/types";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/ui/hooks";
import { FilterPanel } from "./FilterPanel";
import { PlayerProfile } from "./PlayerProfile";
import { PoolControls, type FilterSection } from "./PoolControls";
import {
  PlayerRegistryHero,
  PoolEmptyState,
  PoolErrorState,
  PoolLoadingState,
  PoolSummary,
  SiteFooter,
} from "./PoolChrome";
import { AvailablePlayerMobileTable, AvailablePlayerTable } from "./PlayerTables";
import { AppliedFilterChips, Pagination, filterChips, playerNoun } from "./ResultChrome";
import { SortScreen } from "./SortScreen";

type Overlay = { kind: "filters"; section: FilterSection } | { kind: "sort" } | null;

/** "1 match for “necas”" / "2 matching players". */
function resultCountText(query: PoolQuery, count: number): string {
  const search = query.search.trim();
  if (search) return `${count} ${count === 1 ? "match" : "matches"} for “${search}”`;
  return `${count} matching ${count === 1 ? "player" : "players"}`;
}

/** Result-count line beside the section heading. */
export function resultSummary(query: PoolQuery, count: number): string {
  const sortIsDefault = query.sort.key === DEFAULT_SORT.key && query.sort.direction === DEFAULT_SORT.direction;
  const sortText = sortSummary(query.type, query.sort);
  if (query.search.trim() || hasActiveFilters(query.filters)) {
    const labels = query.search.trim()
      ? []
      : filterChips(query.filters).map((chip) => chip.short);
    const text = [resultCountText(query, count), ...labels].join(" · ");
    return sortIsDefault ? text : `${text} · ${sortText}`;
  }
  const noun = playerNoun(query.type, count);
  return sortIsDefault ? `${count} returning ${noun} · ${sortText}` : `${count} ${noun} · ${sortText}`;
}

export function AvailablePlayersPage() {
  const pool = usePoolSnapshot();
  const snapshot = pool.status === "ready" ? pool.snapshot : null;
  const players = useMemo(() => snapshot?.players ?? [], [snapshot]);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const [query, setQuery] = useState<PoolQuery>(initialQuery);
  const [page, setPage] = useState(1);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const updateQuery = useCallback((update: (query: PoolQuery) => PoolQuery) => {
    setQuery(update);
    setPage(1);
  }, []);

  const results = useMemo(() => applyQuery(players, query), [players, query]);
  const current = paginate(results, page, isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE);
  const profileIndex = profileId === null ? -1 : results.findIndex((player) => player.id === profileId);
  const profilePlayer = profileIndex >= 0 ? results[profileIndex] : undefined;

  const setType = (type: PlayerType) => updateQuery((q) => switchType(q, type));
  const setSearch = (search: string) => updateQuery((q) => ({ ...q, search }));
  const setFilters = (filters: Filters) => updateQuery((q) => ({ ...q, filters }));
  const setSort = (sort: Sort) => updateQuery((q) => ({ ...q, sort }));
  const clearFilters = () => updateQuery((q) => ({ ...q, search: "", filters: EMPTY_FILTERS }));
  const reset = () => updateQuery((q) => ({ ...initialQuery(), type: q.type }));

  const openProfile = (player: Player) => setProfileId(player.id);
  const stepProfile = (delta: number) => {
    const next = results[profileIndex + delta];
    if (next) setProfileId(next.id);
  };

  const heading = query.type === "skater" ? "Available skaters" : "Available goalies";
  const isFiltered = query.search.trim() !== "" || hasActiveFilters(query.filters);

  let listing: React.ReactNode;
  let summaryText: string;
  if (pool.status === "loading") {
    listing = <PoolLoadingState />;
    summaryText = "";
  } else if (pool.status === "error") {
    listing = <PoolErrorState onRetry={pool.retry} />;
    summaryText = "";
  } else if (results.length === 0) {
    listing = <PoolEmptyState onClear={clearFilters} />;
    summaryText = resultSummary(query, 0);
  } else {
    const tableProps = {
      type: query.type,
      players: current.items,
      startRank: current.start,
      sort: query.sort,
      onSort: setSort,
      onOpen: openProfile,
    };
    listing = isMobile ? <AvailablePlayerMobileTable {...tableProps} /> : <AvailablePlayerTable {...tableProps} />;
    summaryText = resultSummary(query, results.length);
  }

  const mobileSubline = `${
    isFiltered ? resultCountText(query, results.length) : `${formatSeason(snapshot?.statsSeason ?? SITE.statsSeason)} actuals`
  } · Swipe stats →`;

  // Modal overlays sit above the list; the list stays mounted (and scrolled) underneath.
  const modalOpen = profilePlayer !== undefined || (isMobile && overlay !== null);

  return (
    <div className="page">
      <div className="page__content" inert={modalOpen}>
        <PlayerRegistryHero />
        <main className="container" id="main">
          <PoolSummary snapshot={snapshot} />
          <div className="controls-wrap">
            <PoolControls
              query={query}
              isMobile={isMobile}
              filtersOpen={overlay?.kind === "filters"}
              onTypeChange={setType}
              onSearchChange={setSearch}
              onOpenFilters={(section) => setOverlay({ kind: "filters", section })}
              onOpenSort={() => setOverlay({ kind: "sort" })}
              onReset={reset}
            />
            {!isMobile && overlay?.kind === "filters" && snapshot ? (
              <>
                <div className="popover-backdrop" onClick={() => setOverlay(null)} aria-hidden="true" />
                <FilterPanel
                  variant="popover"
                  players={players}
                  query={query}
                  focusSection={overlay.section}
                  onApply={(filters) => {
                    setFilters(filters);
                    setOverlay(null);
                  }}
                  onClose={() => setOverlay(null)}
                />
              </>
            ) : null}
          </div>
          {snapshot ? (
            <AppliedFilterChips
              filters={query.filters}
              count={results.length}
              onChange={setFilters}
              onClearAll={() => setFilters(EMPTY_FILTERS)}
            />
          ) : null}
          <section className="results" aria-labelledby="results-heading">
            <div className="results__head">
              <h2 className="results__heading" id="results-heading">
                {pool.status === "loading" ? "Loading player pool" : heading}
              </h2>
              {summaryText ? (
                <p className="results__summary results__summary--desktop" aria-live="polite">
                  {summaryText}
                </p>
              ) : null}
              {snapshot ? <p className="results__summary results__summary--mobile">{mobileSubline}</p> : null}
            </div>
            <div className="results__body">{listing}</div>
          </section>
        </main>
        <div className="container">
          <SiteFooter snapshot={snapshot} />
          {/* Pagination follows the footer rule, as in the approved exports. */}
          {snapshot && results.length > 0 ? <Pagination page={current} type={query.type} onChange={setPage} /> : null}
        </div>
      </div>

      {isMobile && overlay?.kind === "filters" && snapshot ? (
        <FilterPanel
          variant="screen"
          players={players}
          query={query}
          focusSection={overlay.section}
          onApply={(filters) => {
            setFilters(filters);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {isMobile && overlay?.kind === "sort" ? (
        <SortScreen
          type={query.type}
          sort={query.sort}
          onSelect={(sort) => {
            setSort(sort);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {profilePlayer && snapshot ? (
        <PlayerProfile
          key={isMobile ? "sheet" : "drawer"}
          variant={isMobile ? "sheet" : "drawer"}
          player={profilePlayer}
          index={profileIndex}
          total={results.length}
          snapshot={snapshot}
          onPrevious={() => stepProfile(-1)}
          onNext={() => stepProfile(1)}
          onClose={() => setProfileId(null)}
        />
      ) : null}
    </div>
  );
}
