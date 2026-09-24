"use client";

import { useRef } from "react";
import { sortOptionsFor, type Sort } from "@/lib/pool/query";
import type { PlayerType } from "@/lib/pool/types";
import { useModal } from "@/lib/ui/hooks";
import { Check } from "./FilterPanel";

/** The dedicated mobile SORT PLAYERS screen. */
export function SortScreen({ type, sort, onSelect, onClose }: { type: PlayerType; sort: Sort; onSelect: (sort: Sort) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onClose });
  return (
    <div ref={ref} className="filter-panel filter-panel--screen" role="dialog" aria-modal="true" aria-labelledby="sort-title" tabIndex={-1}>
      <button type="button" className="btn btn--back" onClick={onClose}>
        ‹ Back to players
      </button>
      <div className="filter-panel__body">
        <h2 className="panel-title" id="sort-title">
          Sort players
        </h2>
        <div className="option-group__list" role="group" aria-labelledby="sort-title">
          {sortOptionsFor(type).map((option) => {
            const selected = option.sort.key === sort.key && option.sort.direction === sort.direction;
            return (
              <button
                key={option.sort.key}
                type="button"
                className="btn btn--option"
                aria-pressed={selected}
                data-autofocus={selected ? "" : undefined}
                onClick={() => onSelect(option.sort)}
              >
                {selected ? <Check /> : null}
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="panel-note">Unavailable values always appear last.</p>
      </div>
    </div>
  );
}
