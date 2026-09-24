"use client";

import { FRANCHISES, POSITION_LABELS, getNhlTeam } from "@/lib/pool/reference";
import type { Filters, Page } from "@/lib/pool/query";
import type { PlayerType } from "@/lib/pool/types";

export function playerNoun(type: PlayerType, count: number): string {
  const noun = type === "skater" ? "skater" : "goalie";
  return count === 1 ? noun : `${noun}s`;
}

interface Chip {
  key: keyof Filters;
  label: string;
}

export function filterChips(filters: Filters): Chip[] {
  const chips: Chip[] = [];
  const team = getNhlTeam(filters.team);
  if (team) chips.push({ key: "team", label: team.shortName });
  if (filters.position) chips.push({ key: "position", label: POSITION_LABELS[filters.position] });
  const franchise = FRANCHISES.find((f) => f.id === filters.franchise);
  if (franchise) chips.push({ key: "franchise", label: franchise.name });
  return chips;
}

export function AppliedFilterChips({
  filters,
  count,
  onRemove,
  onClearAll,
}: {
  filters: Filters;
  count: number;
  onRemove: (key: keyof Filters) => void;
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
          <li key={chip.key}>
            <button type="button" className="btn btn--chip" onClick={() => onRemove(chip.key)} aria-label={`Remove filter ${chip.label}`}>
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
