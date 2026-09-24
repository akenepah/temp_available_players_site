"use client";

import { useRef, useState } from "react";
import { formatAdp, formatDate, formatSeason } from "@/lib/pool/format";
import { POSITION_LABELS, REASON_LABELS } from "@/lib/pool/reference";
import { columnsFor, tileColumnsFor } from "@/lib/pool/stats";
import type { Player, PoolSnapshot } from "@/lib/pool/types";
import { useModal } from "@/lib/ui/hooks";
import { Portrait, TeamMark } from "./PlayerMedia";

type Tab = "overview" | "stats" | "context";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "context", label: "Context" },
];

interface Props {
  variant: "drawer" | "sheet";
  player: Player;
  index: number;
  total: number;
  snapshot: PoolSnapshot;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

function statValue(player: Player, key: string): number | null {
  return (player.stats as unknown as Record<string, number | null>)[key] ?? null;
}

function StatTiles({ player }: { player: Player }) {
  return (
    <ul className={`stat-tiles stat-tiles--${player.type}`}>
      {tileColumnsFor(player.type).map((column) => (
        <li key={column.key} className="stat-tile">
          <span className="stat-tile__value">{column.format(statValue(player, column.key))}</span>
          <span className="stat-tile__label">{column.tileLabel}</span>
        </li>
      ))}
    </ul>
  );
}

function StatList({ player }: { player: Player }) {
  return (
    <dl className="stat-list">
      {columnsFor(player.type).map((column) => (
        <div key={column.key} className="stat-list__row">
          <dt>
            {column.label} <span className="stat-list__abbr">({column.abbr})</span>
          </dt>
          <dd>{column.format(statValue(player, column.key))}</dd>
        </div>
      ))}
    </dl>
  );
}

function Context({ player, snapshot }: { player: Player; snapshot: PoolSnapshot }) {
  return (
    <section className="profile-context" aria-labelledby="profile-context-title">
      <h3 className="profile-section-title" id="profile-context-title">
        Farm to Fame Context
      </h3>
      <dl className="context-list">
        <div className="context-list__row">
          <dt>Previous F2F team</dt>
          <dd>{player.previousFranchise.name}</dd>
        </div>
        <div className="context-list__row">
          <dt>Reason available</dt>
          <dd>{REASON_LABELS[player.reasonAvailable]}</dd>
        </div>
        <div className="context-list__row">
          <dt>Draft pool</dt>
          <dd>{formatSeason(snapshot.draftSeason)} · Returning player</dd>
        </div>
      </dl>
      <p className="profile-sources">
        {formatSeason(snapshot.statsSeason)} NHL actuals · ADP checked {formatDate(snapshot.adpCheckedAt)}.
      </p>
      <p className="profile-sources profile-sources--small">NHL.com · Yahoo ADP via FantasyPros · F2F</p>
    </section>
  );
}

export function PlayerProfile({ variant, player, index, total, snapshot, onPrevious, onNext, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, { onClose });
  const [tab, setTab] = useState<Tab>("overview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const season = `${formatSeason(snapshot.statsSeason)} Regular Season`;
  const teamLine = `${player.position} / ${player.nhlTeam ? player.nhlTeam.name : "NHL team unassigned"}`;
  const hasPrevious = index > 0;
  const hasNext = index < total - 1;

  const onTabKey = (event: React.KeyboardEvent, current: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (current + delta + TABS.length) % TABS.length;
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  const nav = (
    <div className="profile-nav">
      <span className="profile-nav__position" aria-live="polite">
        {index + 1} of {total}
      </span>
      <button type="button" className="icon-btn" onClick={onPrevious} disabled={!hasPrevious} aria-label="Previous player">
        ‹
      </button>
      <button type="button" className="icon-btn" onClick={onNext} disabled={!hasNext} aria-label="Next player">
        ›
      </button>
    </div>
  );

  const body = (
    <>
      <div className="profile-identity">
        <div className="profile-identity__media">
          <Portrait player={player} size="profile" />
          {!player.portraitUrl ? <p className="profile-note profile-note--small">Portrait unavailable</p> : null}
        </div>
        <div className="profile-identity__text">
          <h2 className="profile-name" id="profile-name">
            <span>{player.firstName}</span> <span>{player.lastName}</span>
          </h2>
          <p className="profile-teamline">
            <span className="visually-hidden">{POSITION_LABELS[player.position]}, </span>
            {teamLine}
          </p>
          <TeamMark team={player.nhlTeam} size="profile" />
        </div>
      </div>
      <div className="profile-badges">
        <span className="badge badge--available">Available</span>
        <span className="badge">
          Yahoo ADP <strong>{formatAdp(player.adp)}</strong>
        </span>
      </div>
      {player.adp === null ? <p className="profile-note">ADP unavailable. This player remains in the draft pool.</p> : null}
      <div className="profile-tabs" role="tablist" aria-label="Player profile sections">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`profile-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="profile-tabpanel"
            tabIndex={tab === t.id ? 0 : -1}
            className="btn btn--tab"
            onClick={() => setTab(t.id)}
            onKeyDown={(event) => onTabKey(event, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="profile-panel" role="tabpanel" id="profile-tabpanel" aria-labelledby={`profile-tab-${tab}`}>
        {tab === "overview" ? (
          <>
            <h3 className="profile-section-title">{season}</h3>
            <StatTiles player={player} />
            <Context player={player} snapshot={snapshot} />
          </>
        ) : null}
        {tab === "stats" ? (
          <>
            <h3 className="profile-section-title">{season}</h3>
            <StatList player={player} />
            <p className="profile-sources profile-sources--small">NHL.com</p>
          </>
        ) : null}
        {tab === "context" ? <Context player={player} snapshot={snapshot} /> : null}
      </div>
    </>
  );

  if (variant === "sheet") {
    return (
      <div ref={ref} className="profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-name" tabIndex={-1}>
        <p className="profile-sheet__brand">Farm to Fame</p>
        <div className="profile-sheet__card">
          <div className="profile-sheet__nav">
            <button type="button" className="btn btn--select" onClick={onClose} data-autofocus="">
              ‹ Back
            </button>
            <div className="profile-sheet__stepper">
              <button type="button" className="btn btn--select" onClick={onPrevious} disabled={!hasPrevious} aria-label="Previous player">
                Previous
              </button>
              <span aria-hidden="true">/</span>
              <button type="button" className="btn btn--select" onClick={onNext} disabled={!hasNext} aria-label="Next player">
                Next
              </button>
            </div>
          </div>
          <p className="visually-hidden" aria-live="polite">
            Player {index + 1} of {total}
          </p>
          {body}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-name" tabIndex={-1}>
        <div className="profile-drawer__bar">
          <button type="button" className="icon-btn icon-btn--close" onClick={onClose} aria-label="Close player profile" data-autofocus="">
            ×
          </button>
          {nav}
        </div>
        {body}
      </div>
    </>
  );
}
