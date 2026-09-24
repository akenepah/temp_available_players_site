"use client";

import { activeFilterCount, sortControlLabel, type PoolQuery } from "@/lib/pool/query";
import type { PlayerType } from "@/lib/pool/types";

export type FilterSection = "team" | "position" | "franchise";

interface Props {
  query: PoolQuery;
  isMobile: boolean;
  filtersOpen: boolean;
  onTypeChange: (type: PlayerType) => void;
  onSearchChange: (search: string) => void;
  onClearSearch: () => void;
  onOpenFilters: (section: FilterSection) => void;
  onOpenSort: () => void;
  onClearFilters: () => void;
}

const TYPES: { type: PlayerType; label: string }[] = [
  { type: "skater", label: "Skaters" },
  { type: "goalie", label: "Goalies" },
];

function Chevron() {
  return (
    <svg className="chevron-down" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Search, tab, filter and sort controls. Search and filters are separate
 * tasks: the × clears only the search, and "Clear filters" clears only the
 * team / position / franchise selections (never search, sort or the tab).
 */
export function PoolControls({
  query,
  isMobile,
  filtersOpen,
  onTypeChange,
  onSearchChange,
  onClearSearch,
  onOpenFilters,
  onOpenSort,
  onClearFilters,
}: Props) {
  const filterCount = activeFilterCount(query.filters);
  const clearSearch = () => {
    onClearSearch();
    document.getElementById("player-search")?.focus();
  };

  return (
    <div className="controls">
      <div className="controls__tabs" role="group" aria-label="Player type">
        {TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            className="btn btn--tab"
            aria-pressed={query.type === type}
            onClick={() => onTypeChange(type)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="controls__search">
        <label htmlFor="player-search" className="visually-hidden">
          Search players
        </label>
        <input
          id="player-search"
          className="search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={isMobile ? "Search players..." : "Search players, teams, positions..."}
          value={query.search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query.search) {
              event.preventDefault();
              clearSearch();
            }
          }}
        />
        {query.search ? (
          <button type="button" className="search__clear" aria-label="Clear search" onClick={clearSearch}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className={`btn btn--select controls__filters${filterCount > 0 ? " controls__filters--active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={filtersOpen}
        aria-label={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
        onClick={() => onOpenFilters("team")}
      >
        Filters{filterCount > 0 ? <span className="controls__count">({filterCount})</span> : null} <Chevron />
      </button>
      {isMobile ? (
        <button
          type="button"
          className="btn btn--select controls__sort"
          aria-haspopup="dialog"
          aria-label={`Sort: ${sortControlLabel(query.type, query.sort)}`}
          onClick={onOpenSort}
        >
          {sortControlLabel(query.type, query.sort)} <Chevron />
        </button>
      ) : null}
      <button type="button" className="btn btn--select controls__clear" onClick={onClearFilters} disabled={filterCount === 0}>
        Clear filters
      </button>
    </div>
  );
}
