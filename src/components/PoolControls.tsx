"use client";

import { POSITION_LABELS, getNhlTeam } from "@/lib/pool/reference";
import { sortControlLabel, type PoolQuery } from "@/lib/pool/query";
import type { PlayerType } from "@/lib/pool/types";

export type FilterSection = "team" | "position" | "franchise";

interface Props {
  query: PoolQuery;
  isMobile: boolean;
  filtersOpen: boolean;
  onTypeChange: (type: PlayerType) => void;
  onSearchChange: (search: string) => void;
  onOpenFilters: (section: FilterSection) => void;
  onOpenSort: () => void;
  onReset: () => void;
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

export function PoolControls({ query, isMobile, filtersOpen, onTypeChange, onSearchChange, onOpenFilters, onOpenSort, onReset }: Props) {
  const team = getNhlTeam(query.filters.team);
  const teamLabel = team ? team.shortName : "All teams";
  const { positions } = query.filters;
  const positionLabel =
    query.type === "goalie"
      ? "Goalies"
      : positions.length === 0
        ? "All positions"
        : positions.length === 1
          ? POSITION_LABELS[positions[0]!]
          : positions.join(" + ");

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
        />
      </div>
      <button
        type="button"
        className="btn btn--select controls__team"
        aria-haspopup="dialog"
        aria-expanded={filtersOpen}
        aria-label={`NHL team filter: ${team ? team.name : "All teams"}`}
        onClick={() => onOpenFilters("team")}
      >
        {teamLabel} <Chevron />
      </button>
      <button
        type="button"
        className="btn btn--select controls__position"
        aria-haspopup="dialog"
        aria-expanded={filtersOpen}
        aria-label={`Position filter: ${positionLabel}`}
        onClick={() => onOpenFilters("position")}
      >
        {positionLabel} <Chevron />
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
      <button type="button" className="btn btn--select controls__reset" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
