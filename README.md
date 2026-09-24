# temp_available_players_site
Public draft-pool explorer for the Farm to Fame keeper league, featuring returning players, NHL statistics, Yahoo ADP, searchable filters, and responsive player profiles.

This is a standalone microsite for **players.farmtofame.com**. It is public and
has no sign-in. The Available Players experience is served at `/`, and
`/available-players` redirects there.

## Stack

Next.js (App Router) · React · TypeScript · Vitest + Testing Library ·
Playwright. Node ≥ 22, pnpm.

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm test                # unit + component tests
pnpm test:e2e            # Playwright (builds and serves production on :3107)
pnpm lint && pnpm typecheck && pnpm build
pnpm validate:snapshot   # check public/data/available-players.json
```

## Data

The site renders one committed JSON snapshot. See [docs/DATA.md](docs/DATA.md).
No snapshot is committed yet, so the site shows its *Player pool unavailable*
state until the authoritative export is added.

To preview locally with test data (never commit the result):

```bash
pnpm exec tsx -e 'import {FIXTURE_SNAPSHOT as s} from "./tests/fixtures/pool"; require("fs").writeFileSync("public/data/available-players.json", JSON.stringify(s))'
```

## Layout

- `src/lib/pool/`: snapshot contract (`types`, `validate`), reference data
  (NHL teams, canonical franchise names), and search/filter/sort/pagination
  logic (`query`).
- `src/components/`: page chrome (hero, summary, states), controls,
  filter panel/screen, sort screen, desktop and mobile tables, player profile
  (desktop drawer and mobile full-screen sheet).
- `public/brand/`: web-optimised copies of the approved paper texture and
  mountain/pine engravings.

## Hero and share artwork

The hero uses the approved mountain and pine engravings. The back-view
three-player artwork (Celebrini #71, McKenna #92, Hutson #48) has a positioned
slot in front of them but has not been supplied yet: add it to `public/brand/`
as a transparent, text-free PNG/WebP and set `heroPlayersSrc` in
`src/lib/site.ts`.

`public/brand/og-available-players.jpg` is the approved share card
(1200×671), used for Open Graph and Twitter previews only.

## Deployment

Deployed as its own Vercel project (separate from the Draft Lottery project),
with production tracking `main`. It uses the Next.js framework preset and needs no
environment variables or `vercel.json`.
