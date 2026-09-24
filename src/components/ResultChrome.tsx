"use client";

import { FRANCHISES, POSITION_LABELS, getNhlTeam } from "@/lib/pool/reference";
import type { Filters, Page } from "@/lib/pool/query";
import type { PlayerType } from "@/lib/pool/types";

export function playerNoun(type: PlayerType, count: number): string {
  const noun = type === "skater" ? "skater" : "goalie";
  return count === 1 ? noun : `${noun}s`;
}

export interface Chip {
  id: string;
  label: string;
  /** Short form for the result summary line, e.g. "LW". */
  short: string;
  /** The filters with only this chip removed. */
  without: (filters: Filters) => Filters;
}

export function filterChips(filters: Filters): Chip[] {
  const chips: Chip[] = [];
  const team = getNhlTeam(filters.team);
  if (team) chips.push({ id: "team", label: team.name, short: team.shortName, without: (f) => ({ ...f, team: null }) });
  for (const position of filters.positions) {
    chips.push({
      id: `position-${position}`,
      label: POSITION_LABELS[position],
      short: position,
      without: (f) => ({ ...f, positions: f.positions.filter((p) => p !== position) }),
    });
  }
  const franchise = FRANCHISES.find((f) => f.id === filters.franchise);
  if (franchise) chips.push({ id: "franchise", label: franchise.name, short: franchise.name, without: (f) => ({ ...f, franchise: null }) });
  return chips;
}

export function AppliedFilterChips({
  filters,
  count,
  onChange,
  onClearAll,
}: {
  filters: Filters;
  count: number;
  onChange: (filters: Filters) => void;
  onClearAll: () => void;
}) {
  const chips = filterChips(filters);
  if (chips.length === 0) return null;
  return (
    <div className="chips" aria-label="Applied filters" role="group">
      <p className="chips__count">
        {count} matching {count === 1 ? "player" : "players"}
      </p>
      <ul className="chips__list">
        {chips.map((chip) => (
          <li key={chip.id}>
            <button type="button" className="btn btn--chip" onClick={() => onChange(chip.without(filters))} aria-label={`Remove filter ${chip.label}`}>
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--chip chips__clear" onClick={onClearAll}>
        Clear all filters
      </button>
    </div>
  );
}

export function Pagination({ page, type, onChange }: { page: Page<unknown>; type: PlayerType; onChange: (page: number) => void }) {
  if (page.total === 0) return null;
  return (
    <nav className="pagination" aria-label="Player list pages">
      <p className="pagination__status" aria-live="polite">
        Showing {page.start}–{page.end} of {page.total} {playerNoun(type, page.total)}
      </p>
      <div className="pagination__controls">
        <button type="button" className="btn btn--page" disabled={page.page <= 1} onClick={() => onChange(page.page - 1)}>
          <span aria-hidden="true">← </span>Previous
        </button>
        <span className="pagination__index" aria-label={`Page ${page.page} of ${page.pageCount}`}>
          {page.page} / {page.pageCount}
        </span>
        <button type="button" className="btn btn--page" disabled={page.page >= page.pageCount} onClick={() => onChange(page.page + 1)}>
          Next<span aria-hidden="true"> →</span>
        </button>
      </div>
    </nav>
  );
}
