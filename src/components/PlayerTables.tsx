"use client";

import { formatAdp } from "@/lib/pool/format";
import { defaultDirection, type Sort, type SortKey } from "@/lib/pool/query";
import { columnsFor } from "@/lib/pool/stats";
import type { Player, PlayerType } from "@/lib/pool/types";
import { Portrait, StackedName, TeamMark } from "./PlayerMedia";

interface TableProps {
  type: PlayerType;
  players: Player[];
  /** 1-based rank of the first row in the current result set. */
  startRank: number;
  sort: Sort;
  onSort: (sort: Sort) => void;
  onOpen: (player: Player, trigger: HTMLElement) => void;
}

function statValue(player: Player, key: string): number | null {
  return (player.stats as unknown as Record<string, number | null>)[key] ?? null;
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  fullLabel,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (sort: Sort) => void;
  className?: string;
  fullLabel: string;
}) {
  const active = sort.key === sortKey;
  const next: Sort = active
    ? { key: sortKey, direction: sort.direction === "asc" ? "desc" : "asc" }
    : { key: sortKey, direction: defaultDirection(sortKey) };
  return (
    <th scope="col" className={className} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className={`sort-btn${active ? " sort-btn--active" : ""}`} onClick={() => onSort(next)} aria-label={`Sort by ${fullLabel}`}>
        {label}
        {active ? <span aria-hidden="true">{sort.direction === "asc" ? " ↑" : " ↓"}</span> : null}
      </button>
    </th>
  );
}

/** Opens the profile from anywhere on the row; the name button is the keyboard/AT entry point. */
function rowClick(player: Player, onOpen: TableProps["onOpen"]) {
  return (event: React.MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const trigger = event.currentTarget.querySelector<HTMLElement>(".player-open");
    if (trigger) onOpen(player, trigger);
  };
}

function PlayerOpenButton({ player, onOpen }: { player: Player; onOpen: TableProps["onOpen"] }) {
  return (
    <button type="button" className="player-open" onClick={(event) => onOpen(player, event.currentTarget)} aria-label={`${player.fullName}, open player profile`}>
      <Portrait player={player} size="row" />
      <StackedName player={player} />
    </button>
  );
}

export function AvailablePlayerTable({ type, players, startRank, sort, onSort, onOpen }: TableProps) {
  const columns = columnsFor(type);
  return (
    <table className={`player-table player-table--${type}`}>
      <caption className="visually-hidden">{type === "skater" ? "Available skaters" : "Available goalies"}</caption>
      <thead>
        <tr>
          <th scope="col" className="col-rank">
            #
          </th>
          <SortHeader label="Player" fullLabel="player name" sortKey="name" sort={sort} onSort={onSort} className="col-player" />
          <th scope="col" className="col-team">
            Team
          </th>
          <th scope="col" className="col-pos">
            Pos
          </th>
          <th scope="col" className="col-prev">
            Prev. F2F
          </th>
          <SortHeader label="ADP" fullLabel="Yahoo ADP" sortKey="adp" sort={sort} onSort={onSort} className="col-num col-adp" />
          {columns.map((column) => (
            <SortHeader key={column.key} label={column.abbr} fullLabel={column.label} sortKey={column.key} sort={sort} onSort={onSort} className="col-num" />
          ))}
          <th scope="col" className="col-chevron">
            <span className="visually-hidden">Open</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {players.map((player, index) => (
          <tr key={player.id} className="player-row" onClick={rowClick(player, onOpen)}>
            <td className="col-rank">{startRank + index}</td>
            <th scope="row" className="col-player">
              <PlayerOpenButton player={player} onOpen={onOpen} />
            </th>
            <td className="col-team">
              <TeamMark team={player.nhlTeam} />
            </td>
            <td className="col-pos">{player.position}</td>
            <td className="col-prev">{player.previousFranchise.name}</td>
            <td className="col-num col-adp">{formatAdp(player.adp)}</td>
            {columns.map((column) => (
              <td key={column.key} className="col-num">
                {column.format(statValue(player, column.key))}
              </td>
            ))}
            <td className="col-chevron" aria-hidden="true">
              ›
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Mobile list: identity, team, position and ADP are visible first; the
 * remaining 2025–26 actuals scroll horizontally while the player column stays pinned.
 */
export function AvailablePlayerMobileTable({ type, players, sort, onOpen }: TableProps) {
  const columns = columnsFor(type);
  const arrow = (key: SortKey) => (sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : "");
  return (
    <div className="mobile-table-scroll" tabIndex={0} role="region" aria-label="Player statistics, scroll horizontally for more">
      <table className="mobile-table">
        <caption className="visually-hidden">{type === "skater" ? "Available skaters" : "Available goalies"}</caption>
        <thead>
          <tr>
            <th scope="col" className="m-col-player">
              Player
            </th>
            <th scope="col" className="m-col-team">
              Team
            </th>
            <th scope="col" className="m-col-pos">
              Pos
            </th>
            <th scope="col" className="m-col-num" aria-sort={sort.key === "adp" ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
              ADP{arrow("adp")}
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="m-col-num"
                aria-sort={sort.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
              >
                {column.abbr}
                {arrow(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="player-row" onClick={rowClick(player, onOpen)}>
              <th scope="row" className="m-col-player">
                <PlayerOpenButton player={player} onOpen={onOpen} />
              </th>
              <td className="m-col-team">
                <TeamMark team={player.nhlTeam} />
              </td>
              <td className="m-col-pos">{player.position}</td>
              <td className="m-col-num">{formatAdp(player.adp)}</td>
              {columns.map((column) => (
                <td key={column.key} className="m-col-num">
                  {column.format(statValue(player, column.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
