# Player pool snapshot — data contract

The site has exactly one runtime source of truth: a static JSON file served at
`/data/available-players.json`, committed at
`public/data/available-players.json`. The site has no database, no Supabase
connection and no dependency on the main Farm to Fame portal.

**No snapshot is committed yet.** Until the authoritative 2026–27 returning-player
export is added, the site shows the **Player pool unavailable** state. It
never shows sample data. The fixture in `tests/fixtures/pool.ts` is for tests
only and must never be copied into `public/data/`.

## Publishing or updating the pool

1. Export the authoritative pool in the shape below and save it to
   `public/data/available-players.json`.
2. Run `pnpm validate:snapshot`. It rejects the whole file on any invalid
   record. It never drops a player silently.
3. Commit and merge to `main`. Vercel redeploys, and the file is served with
   `Cache-Control: max-age=0, must-revalidate`, so visitors get it on the next load.

## Shape (`schemaVersion: 1`)

```jsonc
{
  "schemaVersion": 1,
  "draftSeason": "2026-27",          // draft the pool feeds
  "statsSeason": "2025-26",          // season the ACTUAL stats cover
  "updatedAt": "YYYY-MM-DD",         // "Last updated" / hero "Updated ·"
  "adpCheckedAt": "YYYY-MM-DD",      // "ADP checked …" / footer date
  "keeperDecisions": { "completed": 10, "total": 10 },
  "commissionerSelection": null,     // required key; null, or { "franchiseId", "returnCount" }.
                                      // Validated but not displayed: the finalized 2026–27
                                      // pool already reflects Purple Reign's outcomes.
  "players": [
    {
      "id": "string, unique",         // stable key; the NHL player id works well
      "nhlPlayerId": 1234567,         // or null
      "firstName": "…",
      "lastName": "…",
      "position": "C | LW | RW | D | G",   // G ⇒ goalie; otherwise skater
      "nhlTeam": "MIN",               // NHL abbreviation, or null ⇒ "NHL team unassigned"
      "previousFranchiseId": "the-offensive-otters",
      "reasonAvailable": "contract_expired | released",
      "adp": 8,                       // Yahoo ADP, or null ⇒ "—", sorted last
      "portraitUrl": "https://assets.nhle.com/mugs/nhl/…png",  // or null ⇒ initials
      "stats": {
        // skaters: gp, g, a, pts, ppp, sog, hit, blk
        // goalies: gp, w, sv, svPct (fraction, e.g. 0.912)
        // any value may be null ⇒ "—"; never use 0 for "unknown"
      }
    }
  ]
}
```

The available-player count and the skater/goalie split come from `players`.
They are never typed in by hand.

### Franchise ids

`bestial-backwoods-delight`, `f-u-shoresy`, `if-it-makes-you-saad`,
`joshs-team`, `mccaben-it-real-goes-wrong`, `purple-reign`,
`stache-ing-ginos`, `the-offensive-otters`, `timbitches`,
`weekend-at-beniers`.

The obsolete id `jet-blue-holiday` (the main portal's seed slug) is accepted
and displayed under the canonical current name, **McCabe'n It Real Goes
Wrong**. Display names live in `src/lib/pool/reference.ts`.

### Sources and labelling

- Stats are **2025–26 NHL regular-season actuals** (NHL.com). They are labelled
  as actuals everywhere. The site has no projection fields, so none can be shown.
- ADP is **Yahoo ADP via FantasyPros**. Enter it from that published source.
  Do not scrape Yahoo.
- NHL team marks load unaltered from `assets.nhle.com`. Portraits use whatever
  URL the snapshot provides.
