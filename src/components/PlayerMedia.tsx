"use client";

import { useState } from "react";
import { initials } from "@/lib/pool/format";
import { nhlTeamLogoUrl, type NhlTeam } from "@/lib/pool/reference";
import type { Player } from "@/lib/pool/types";

/** Player headshot, falling back to an initials block when no portrait exists or it fails to load. */
export function Portrait({ player, size }: { player: Player; size: "row" | "profile" }) {
  const [failed, setFailed] = useState(false);
  const className = `portrait portrait--${size}`;
  if (!player.portraitUrl || failed) {
    return (
      <span className={`${className} portrait--fallback`} data-testid="portrait-fallback" aria-hidden="true">
        {initials(player.firstName, player.lastName)}
      </span>
    );
  }
  return (
    // Remote NHL headshots are served as-is; next/image optimisation would re-encode them.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={player.portraitUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

export function TeamMark({ team, size = "row" }: { team: NhlTeam | null; size?: "row" | "profile" }) {
  const [failed, setFailed] = useState(false);
  if (!team) return <span className="team-mark team-mark--none">—</span>;
  if (failed) return <span className="team-mark team-mark--text">{team.abbrev}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`team-mark team-mark--${size}`}
      src={nhlTeamLogoUrl(team.abbrev)}
      alt={team.name}
      title={team.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Name set in two stacked lines, as in the approved table rows. */
export function StackedName({ player }: { player: Player }) {
  return (
    <span className="stacked-name">
      <span>{player.firstName}</span> <span>{player.lastName}</span>
    </span>
  );
}
