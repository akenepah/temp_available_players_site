import { formatDate, formatSeason, formatSeasonLong, UNAVAILABLE } from "@/lib/pool/format";
import { SITE } from "@/lib/site";
import type { PoolSnapshot } from "@/lib/pool/types";

/** Page masthead. Desktop is the wide Player Registry composition; mobile is the stacked one (CSS). */
export function PlayerRegistryHero() {
  const draft = formatSeason(SITE.draftSeason);
  return (
    <header className="hero">
      <div className="hero__art" aria-hidden="true">
        <span className="hero__mountains" />
        <span className="hero__pines" />
        {SITE.heroPlayersSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero__players" src={SITE.heroPlayersSrc} alt="" fetchPriority="high" />
        ) : null}
      </div>
      <div className="hero__inner">
        <div className="hero__topline">
          <p className="hero__identity">
            <span className="hero__brand">Farm to Fame</span>
            <span className="hero__registry">{formatSeasonLong(SITE.draftSeason)} Player Registry</span>
          </p>
          <p className="hero__draft">
            <span className="hero__draft-label">{draft} Draft</span>
          </p>
        </div>
        <h1 className="hero__title">Available Players</h1>
        <p className="hero__lede hero__lede--desktop">
          Review returning players and their {formatSeason(SITE.statsSeason)} NHL season statistics.
        </p>
        <p className="hero__lede hero__lede--mobile">Players returning to the {draft} draft.</p>
      </div>
    </header>
  );
}

export function PoolSummary({ snapshot }: { snapshot: PoolSnapshot | null }) {
  const total = snapshot ? String(snapshot.players.length) : UNAVAILABLE;
  const decisions = snapshot ? `${snapshot.keeperDecisions.completed}/${snapshot.keeperDecisions.total}` : UNAVAILABLE;
  const updated = snapshot ? formatDate(snapshot.updatedAt) : UNAVAILABLE;
  return (
    <dl className="summary" aria-label="Pool summary">
      <div className="summary__item summary__item--count">
        <dt>Available players</dt>
        <dd>{total}</dd>
      </div>
      <div className="summary__item summary__item--count">
        <dt>Keeper decisions</dt>
        <dd>{decisions}</dd>
      </div>
      <div className="summary__item">
        <dt>Last updated</dt>
        <dd>{updated}</dd>
      </div>
    </dl>
  );
}

export function SiteFooter({ snapshot }: { snapshot: PoolSnapshot | null }) {
  return (
    <footer className="footer">
      <p className="footer__brand">
        Farm to Fame<span className="footer__draft"> / {formatSeason(SITE.draftSeason)} Draft</span>
      </p>
      <p className="footer__sources">
        {formatSeason(snapshot?.statsSeason ?? SITE.statsSeason)} NHL actuals · Yahoo ADP via FantasyPros
        {snapshot ? ` · ${formatDate(snapshot.adpCheckedAt)}` : ""}
      </p>
    </footer>
  );
}

function StateCard({ title, body, children, busy }: { title: string; body: string; children?: React.ReactNode; busy?: boolean }) {
  return (
    <div className="state-card" role={busy ? "status" : undefined} aria-busy={busy || undefined}>
      <h3 className="state-card__title">{title}</h3>
      <p className="state-card__body">{body}</p>
      {children}
    </div>
  );
}

export function PoolLoadingState() {
  return (
    <StateCard title="Loading player pool" body="Fetching the latest available player list." busy>
      <span className="skeleton skeleton--block" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line" />
    </StateCard>
  );
}

export function PoolEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <StateCard title="No players found" body="Try another name or clear your filters.">
      <button type="button" className="btn btn--primary btn--block" onClick={onClear}>
        Clear filters
      </button>
    </StateCard>
  );
}

export function PoolErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <StateCard title="Player pool unavailable" body="We couldn’t load the player list. Please try again.">
        <button type="button" className="btn btn--primary btn--block" onClick={onRetry}>
          Try again
        </button>
      </StateCard>
    </div>
  );
}
