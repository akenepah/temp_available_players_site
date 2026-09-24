"use client";

import { useMemo, useRef, useState } from "react";
import { FRANCHISES, POSITION_LABELS, type Position } from "@/lib/pool/reference";
import { applyQuery, positionsFor, EMPTY_FILTERS, type Filters, type PoolQuery } from "@/lib/pool/query";
import type { Player } from "@/lib/pool/types";
import { useModal } from "@/lib/ui/hooks";
import type { FilterSection } from "./PoolControls";

interface Props {
  variant: "popover" | "screen";
  players: readonly Player[];
  query: PoolQuery;
  focusSection: FilterSection;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}

interface Option<V> {
  value: V | null;
  label: string;
}

function OptionGroup<V extends string>({
  id,
  label,
  options,
  selected,
  onSelect,
  scroll,
  autoFocus,
}: {
  id: string;
  label: string;
  options: Option<V>[];
  selected: V | null;
  onSelect: (value: V | null) => void;
  scroll?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="option-group">
      <h3 className="option-group__label" id={id}>
        {label}
      </h3>
      <div className={`option-group__list${scroll ? " option-group__list--scroll" : ""}`} role="group" aria-labelledby={id}>
        {options.map((option, index) => {
          // "All …" clears the dimension; it is an action, not a filled selection (per the approved panel).
          const isAll = option.value === null;
          const isSelected = !isAll && option.value === selected;
          return (
            <button
              key={option.value ?? "all"}
              type="button"
              className="btn btn--option"
              aria-pressed={isAll ? undefined : isSelected}
              data-autofocus={autoFocus && (isSelected || (selected === null && index === 0)) ? "" : undefined}
              onClick={() => onSelect(option.value)}
            >
              {isSelected ? <Check /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Check() {
  return (
    <svg className="check" viewBox="0 0 12 10" aria-hidden="true">
      <path d="M1 5.5l3.2 3L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Combined NHL team / position / previous franchise filter. Selections are
 * staged here and only applied by "Show N players"; options come from the
 * players actually in the pool for the active player type.
 */
export function FilterPanel({ variant, players, query, focusSection, onApply, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onClose, lockScroll: variant === "screen", trapFocus: true });
  const [staged, setStaged] = useState<Filters>(query.filters);

  const ofType = useMemo(() => players.filter((player) => player.type === query.type), [players, query.type]);

  const teamOptions = useMemo<Option<string>[]>(() => {
    const teams = new Map<string, string>();
    for (const player of ofType) if (player.nhlTeam) teams.set(player.nhlTeam.abbrev, player.nhlTeam.name);
    return [
      { value: null, label: "All NHL teams" },
      ...[...teams].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ];
  }, [ofType]);

  const positionOptions = useMemo<Option<Position>[]>(() => {
    const present = new Set(ofType.map((player) => player.position));
    return [
      { value: null, label: query.type === "goalie" ? "All goalies" : "All positions" },
      ...positionsFor(query.type)
        .filter((position) => present.has(position))
        .map((value) => ({ value, label: POSITION_LABELS[value] })),
    ];
  }, [ofType, query.type]);

  const franchiseOptions = useMemo<Option<string>[]>(() => {
    const present = new Set(ofType.map((player) => player.previousFranchise.id));
    return [
      { value: null, label: "All franchises" },
      ...FRANCHISES.filter((franchise) => present.has(franchise.id)).map((franchise) => ({ value: franchise.id, label: franchise.name })),
    ];
  }, [ofType]);

  const resultCount = useMemo(() => applyQuery(players, { ...query, filters: staged }).length, [players, query, staged]);

  return (
    <div
      ref={ref}
      className={`filter-panel filter-panel--${variant}`}
      role="dialog"
      aria-modal={variant === "screen" ? true : undefined}
      aria-labelledby="filter-panel-title"
      tabIndex={-1}
    >
      {variant === "screen" ? (
        <button type="button" className="btn btn--back" onClick={onClose}>
          ‹ Back to players
        </button>
      ) : null}
      <div className="filter-panel__body">
        <h2 className="panel-title" id="filter-panel-title">
          Filter players
        </h2>
        <p className="panel-lede">Combine filters to narrow the returning pool.</p>
        <OptionGroup
          id="filter-team"
          label="NHL team"
          options={teamOptions}
          selected={staged.team}
          onSelect={(team) => setStaged((s) => ({ ...s, team }))}
          scroll={variant === "popover"}
          autoFocus={focusSection === "team"}
        />
        <OptionGroup
          id="filter-position"
          label="NHL position"
          options={positionOptions}
          selected={staged.position}
          onSelect={(position) => setStaged((s) => ({ ...s, position }))}
          autoFocus={focusSection === "position"}
        />
        <OptionGroup
          id="filter-franchise"
          label="Previous F2F franchise"
          options={franchiseOptions}
          selected={staged.franchise}
          onSelect={(franchise) => setStaged((s) => ({ ...s, franchise }))}
          autoFocus={focusSection === "franchise"}
        />
        <div className="panel-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setStaged(EMPTY_FILTERS)}>
            Clear
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onApply(staged)}>
            Show {resultCount} {resultCount === 1 ? "player" : "players"}
          </button>
        </div>
      </div>
    </div>
  );
}
