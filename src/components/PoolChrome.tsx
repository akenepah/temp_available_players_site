import { formatDate, formatSeason, UNAVAILABLE } from "@/lib/pool/format";
import { SITE } from "@/lib/site";
import type { PoolSnapshot } from "@/lib/pool/types";

/** Page masthead. Desktop is the wide Player Registry composition; mobile is the stacked one (CSS). */
export function PlayerRegistryHero({ updatedAt }: { updatedAt: string | null }) {
  const draft = formatSeason(SITE.draftSeason);
  return (
    <header className="hero">
      <div className="hero__art" aria-hidden="true">
        {/* The approved player collage is not yet in the repository (see README). The
            mountain and pine engravings are the approved illustration assets. */}
        {SITE.heroCollageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hero__collage" src={SITE.heroCollageSrc} alt="" />
        ) : null}
        <span className="hero__mountains" />
        <span className="hero__pines" />
      </div>
      <div className="hero__inner">
        <div className="hero__topline">
          <p className="hero__identity">
            <span className="hero__brand">Farm to Fame</span>
            <span className="hero__sub">
              <span aria-hidden="true">→ </span>Fantasy Hockey
            </span>
          </p>
          <p className="hero__draft">
            <span className="hero__draft-label">{draft} Draft</span>
            {updatedAt ? <span className="hero__updated">Updated · {formatDate(updatedAt)}</span> : null}
          </p>
          <p className="hero__registry" aria-label={`${draft} Player Registry`}>
            <span>{draft}</span>
            <span>Player Registry</span>
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

export function ReturningPoolNotice({ snapshot }: { snapshot: PoolSnapshot | null }) {
  const selection = snapshot?.commissionerSelection ?? null;
  const draft = formatSeason(snapshot?.draftSeason ?? SITE.draftSeason);
  return (
    <section className="notice" aria-label="Returning draft pool notice">
      <svg className="notice__icon" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2.25" />
        <rect x="14.75" y="8" width="2.5" height="11" rx="1" fill="currentColor" />
        <circle cx="16" cy="23" r="1.6" fill="currentColor" />
      </svg>
      <h2 className="notice__title">{draft} Returning Draft Pool</h2>
      {selection ? (
        <>
          <p className="notice__text notice__text--desktop">
            Includes {selection.franchise.name}’s {selection.returnCount} returns using commissioner-selected keepers.
          </p>
          <p className="notice__text notice__text--mobile">{selection.franchise.name}: commissioner-selected keepers.</p>
        </>
      ) : null}
    </section>
  );
}

export function PoolSummary({ snapshot }: { snapshot: PoolSnapshot | null }) {
  const total = snapshot ? String(snapshot.players.length) : UNAVAILABLE;
  const decisions = snapshot ? `${snapshot.keeperDecisions.completed}/${snapshot.keeperDecisions.total}` : UNAVAILABLE;
  const pick = snapshot ? (snapshot.commissionerSelection?.franchise.name ?? "None") : UNAVAILABLE;
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
        <dt>Commissioner pick</dt>
        <dd>{pick}</dd>
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
