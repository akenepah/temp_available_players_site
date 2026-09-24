"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatSeason } from "@/lib/pool/format";
import { SITE } from "@/lib/site";
import { usePoolSnapshot } from "@/lib/pool/load";
import {
  applyQuery,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  hasActiveFilters,
  PAGE_SIZE_OPTIONS,
  paginate,
  sortSummary,
  switchType,
  type Filters,
  type PoolQuery,
  type Sort,
} from "@/lib/pool/query";
import type { Player, PlayerType } from "@/lib/pool/types";
import { DEFAULT_VIEW, parseViewState, serializeViewState, type ViewState } from "@/lib/pool/urlState";
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

type HistoryMode = "push" | "replace";

/** A view plus how its URL should be recorded: pushed as a new history entry, or replacing the current one. */
interface Navigation {
  view: ViewState;
  mode: HistoryMode;
}

const noopSubscribe = () => () => {};

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
  const [overlay, setOverlay] = useState<Overlay>(null);

  // The URL is the source of truth for the browse state. The server render
  // uses defaults; once mounted, the view is read from the address bar.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [nav, setNav] = useState<Navigation>({ view: DEFAULT_VIEW, mode: "replace" });
  const [urlLoaded, setUrlLoaded] = useState(false);
  if (mounted && !urlLoaded) {
    setUrlLoaded(true);
    setNav({ view: parseViewState(window.location.search), mode: "replace" });
  }
  const { view } = nav;
  const { query } = view;

  const change = useCallback((update: (view: ViewState) => ViewState, mode: HistoryMode = "push") => {
    setNav((current) => ({ view: update(current.view), mode }));
  }, []);
  /** Any change to what is listed returns to page 1. */
  const updateQuery = useCallback(
    (update: (query: PoolQuery) => PoolQuery, mode: HistoryMode = "push") =>
      change((v) => ({ ...v, query: update(v.query), page: 1 }), mode),
    [change],
  );

  // Write the view to the address bar. Typing replaces the current entry;
  // deliberate choices (filters, sort, page, tab, profile) add one, so
  // Back/Forward step through them naturally.
  useEffect(() => {
    if (!urlLoaded) return;
    const search = serializeViewState(nav.view);
    if (search === window.location.search) return;
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    if (nav.mode === "push") {
      const openingProfile = nav.view.player !== null && !new URLSearchParams(window.location.search).has("player");
      window.history.pushState(openingProfile ? { fromList: true } : null, "", url);
    } else {
      window.history.replaceState(nav.view.player ? window.history.state : null, "", url);
    }
  }, [nav, urlLoaded]);

  // Back/Forward: the URL has already changed; read the view back from it.
  useEffect(() => {
    const onPopState = () => setNav({ view: parseViewState(window.location.search), mode: "replace" });
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const results = useMemo(() => applyQuery(players, query), [players, query]);
  const current = paginate(results, view.page, view.pageSize);
  const profileIndex = view.player === null ? -1 : results.findIndex((player) => player.id === view.player);
  const profilePlayer = profileIndex >= 0 ? results[profileIndex] : undefined;

  // Reconcile a linked/restored URL with the data once it has loaded
  // (adjusted during render, so there is no extra effect pass):
  // - a player on the other tab switches tabs; an unknown one is dropped;
  // - a page past the end settles on the last page.
  if (snapshot && urlLoaded) {
    if (view.player !== null && profileIndex === -1) {
      const linked = snapshot.players.find((p) => p.id === view.player);
      if (linked && linked.type !== query.type) {
        change((v) => ({ ...v, query: switchType(v.query, linked.type), page: 1 }), "replace");
      } else {
        change((v) => ({ ...v, player: null }), "replace");
      }
    } else if (view.page !== current.page) {
      change((v) => ({ ...v, page: current.page }), "replace");
    }
  }

  const setType = (type: PlayerType) => updateQuery((q) => switchType(q, type));
  const setSearch = (search: string) => updateQuery((q) => ({ ...q, search }), "replace");
  const clearSearch = () => updateQuery((q) => ({ ...q, search: "" }));
  const setFilters = (filters: Filters) => updateQuery((q) => ({ ...q, filters }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const setSort = (sort: Sort) => updateQuery((q) => ({ ...q, sort }));
  const setPage = (page: number) => change((v) => ({ ...v, page }));
  const setPageSize = (pageSize: number) => change((v) => ({ ...v, pageSize, page: 1 }));

  // Opening a profile adds a history entry, so Back / swipe-back closes it.
  const openProfile = (player: Player) => change((v) => ({ ...v, player: player.id }));
  // Previous/Next replace the entry: Back returns to the list, not through every player viewed.
  const stepProfile = (delta: number) => {
    const next = results[profileIndex + delta];
    if (next) change((v) => ({ ...v, player: next.id }), "replace");
  };
  const closeProfile = () => {
    if ((window.history.state as { fromList?: boolean } | null)?.fromList) {
      window.history.back(); // popstate restores the list view exactly as it was
    } else {
      change((v) => ({ ...v, player: null }), "replace"); // opened from a link or a refresh
    }
  };

  const heading = query.type === "skater" ? "Available skaters" : "Available goalies";
  const hasSearch = query.search.trim() !== "";
  const isFiltered = hasSearch || hasActiveFilters(query.filters);

  let listing: React.ReactNode;
  let summaryText: string;
  if (pool.status === "loading") {
    listing = <PoolLoadingState />;
    summaryText = "";
  } else if (pool.status === "error") {
    listing = <PoolErrorState onRetry={pool.retry} />;
    summaryText = "";
  } else if (results.length === 0) {
    listing = (
      <PoolEmptyState
        search={query.search.trim()}
        hasFilters={hasActiveFilters(query.filters)}
        onClearSearch={clearSearch}
        onClearFilters={clearFilters}
      />
    );
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
  } · Swipe for more stats →`;

  // Modal overlays sit above the list; the list stays mounted (and scrolled) underneath.
  const modalOpen = profilePlayer !== undefined || (isMobile && overlay !== null);

  const filterPanelProps = {
    players,
    query,
    focusSection: overlay?.kind === "filters" ? overlay.section : ("team" as FilterSection),
    onApply: (filters: Filters) => {
      setFilters(filters);
      setOverlay(null);
    },
    onClose: () => setOverlay(null),
  };

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
              onClearSearch={clearSearch}
              onOpenFilters={(section) => setOverlay({ kind: "filters", section })}
              onOpenSort={() => setOverlay({ kind: "sort" })}
              onClearFilters={clearFilters}
            />
            {!isMobile && overlay?.kind === "filters" && snapshot ? (
              <>
                <div className="popover-backdrop" onClick={() => setOverlay(null)} aria-hidden="true" />
                <FilterPanel variant="popover" {...filterPanelProps} />
              </>
            ) : null}
          </div>
          {snapshot ? (
            <AppliedFilterChips filters={query.filters} count={results.length} onChange={setFilters} onClearAll={clearFilters} />
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
          {snapshot && results.length > 0 ? (
            <Pagination
              page={current}
              type={query.type}
              onChange={setPage}
              pageSize={view.pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>

      {isMobile && overlay?.kind === "filters" && snapshot ? <FilterPanel variant="screen" {...filterPanelProps} /> : null}
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
          onClose={closeProfile}
        />
      ) : null}
    </div>
  );
}
