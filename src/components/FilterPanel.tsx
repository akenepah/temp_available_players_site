"use client";

import { useMemo, useRef, useState } from "react";
import { FRANCHISES, NHL_TEAMS, POSITION_LABELS, type Position } from "@/lib/pool/reference";
import { applyQuery, positionsFor, togglePosition, EMPTY_FILTERS, type Filters, type PoolQuery } from "@/lib/pool/query";
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

/** Every current NHL team, alphabetical by full name — not derived from the pool. */
const TEAM_OPTIONS = [...NHL_TEAMS].sort((a, b) => a.name.localeCompare(b.name));

export function Check() {
  return (
    <svg className="check" viewBox="0 0 12 10" aria-hidden="true">
      <path d="M1 5.5l3.2 3L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`selector__chevron${open ? " selector__chevron--open" : ""}`} viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** One collapsible filter dimension: a summary button that reveals its options. */
function Selector({
  id,
  label,
  value,
  active,
  open,
  autoFocus,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  value: string;
  active: boolean;
  open: boolean;
  autoFocus: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="selector">
      <p className="selector__label" id={`${id}-label`}>
        {label}
      </p>
      <button
        type="button"
        className={`selector__button${active ? " selector__button--active" : ""}`}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-describedby={`${id}-label`}
        data-autofocus={autoFocus ? "" : undefined}
        onClick={onToggle}
      >
        <span className="selector__value">{value}</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="selector__options" id={`${id}-options`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A native radio/checkbox styled as an option row, with an explicit checked treatment. */
function OptionRow({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`option-row${checked ? " option-row--checked" : ""}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} className="visually-hidden" />
      <span className={`option-row__mark option-row__mark--${type}`} aria-hidden="true">
        {checked ? <Check /> : null}
      </span>
      <span className="option-row__text">{label}</span>
    </label>
  );
}

type Section = "team" | "position" | "franchise";

/**
 * Combined NHL team / position / previous franchise filter. Selections are
 * staged here and only applied by "Show N players". Team and franchise are
 * single-select; positions are multi-select (OR within, AND across dimensions).
 */
export function FilterPanel({ variant, players, query, focusSection, onApply, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onClose, lockScroll: variant === "screen", trapFocus: true });
  const [staged, setStaged] = useState<Filters>(query.filters);
  const isGoalie = query.type === "goalie";
  const initialSection: Section = isGoalie && focusSection === "position" ? "team" : focusSection;
  const [open, setOpen] = useState<Section | null>(initialSection);

  const skaterPositions = positionsFor("skater");
  const resultCount = useMemo(() => applyQuery(players, { ...query, filters: staged }).length, [players, query, staged]);

  const toggle = (section: Section) => setOpen((current) => (current === section ? null : section));
  const teamName = NHL_TEAMS.find((team) => team.abbrev === staged.team)?.name;
  const franchiseName = FRANCHISES.find((franchise) => franchise.id === staged.franchise)?.name;
  const positionValue =
    staged.positions.length === 0 ? "All Positions" : staged.positions.map((position) => POSITION_LABELS[position]).join(", ");

  const setPositions = (positions: Position[]) => setStaged((s) => ({ ...s, positions }));

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

        <Selector
          id="filter-team"
          label="NHL Team"
          value={teamName ?? "All NHL Teams"}
          active={staged.team !== null}
          open={open === "team"}
          autoFocus={initialSection === "team"}
          onToggle={() => toggle("team")}
        >
          <fieldset className="option-list option-list--scroll">
            <legend className="visually-hidden">NHL Team</legend>
            <OptionRow
              type="radio"
              name="filter-team"
              label="All NHL Teams"
              checked={staged.team === null}
              onChange={() => {
                setStaged((s) => ({ ...s, team: null }));
                setOpen(null);
              }}
            />
            {TEAM_OPTIONS.map((team) => (
              <OptionRow
                key={team.abbrev}
                type="radio"
                name="filter-team"
                label={team.name}
                checked={staged.team === team.abbrev}
                onChange={() => {
                  setStaged((s) => ({ ...s, team: team.abbrev }));
                  setOpen(null);
                }}
              />
            ))}
          </fieldset>
        </Selector>

        {isGoalie ? null : (
          <Selector
            id="filter-position"
            label="NHL Position"
            value={positionValue}
            active={staged.positions.length > 0}
            open={open === "position"}
            autoFocus={initialSection === "position"}
            onToggle={() => toggle("position")}
          >
            <fieldset className="option-list">
              <legend className="visually-hidden">NHL Position (choose any)</legend>
              <OptionRow
                type="checkbox"
                name="filter-position-all"
                label="All Positions"
                checked={staged.positions.length === 0}
                onChange={() => setPositions([])}
              />
              {skaterPositions.map((position) => (
                <OptionRow
                  key={position}
                  type="checkbox"
                  name="filter-position"
                  label={POSITION_LABELS[position]}
                  checked={staged.positions.includes(position)}
                  onChange={() => setPositions(togglePosition(staged.positions, position, skaterPositions))}
                />
              ))}
            </fieldset>
          </Selector>
        )}

        <Selector
          id="filter-franchise"
          label="Previous F2F Franchise"
          value={franchiseName ?? "All Franchises"}
          active={staged.franchise !== null}
          open={open === "franchise"}
          autoFocus={initialSection === "franchise"}
          onToggle={() => toggle("franchise")}
        >
          <fieldset className="option-list">
            <legend className="visually-hidden">Previous F2F Franchise</legend>
            <OptionRow
              type="radio"
              name="filter-franchise"
              label="All Franchises"
              checked={staged.franchise === null}
              onChange={() => {
                setStaged((s) => ({ ...s, franchise: null }));
                setOpen(null);
              }}
            />
            {FRANCHISES.map((franchise) => (
              <OptionRow
                key={franchise.id}
                type="radio"
                name="filter-franchise"
                label={franchise.name}
                checked={staged.franchise === franchise.id}
                onChange={() => {
                  setStaged((s) => ({ ...s, franchise: franchise.id }));
                  setOpen(null);
                }}
              />
            ))}
          </fieldset>
        </Selector>
      </div>
      <div className="panel-actions">
        <button type="button" className="btn btn--secondary" onClick={() => setStaged(EMPTY_FILTERS)}>
          Clear
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onApply(staged)}>
          Show {resultCount} {resultCount === 1 ? "player" : "players"}
        </button>
      </div>
    </div>
  );
}
