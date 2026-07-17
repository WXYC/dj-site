# Bundle baseline — Next.js modernization pass

Baseline of per-route client JS for the routes called out across the Next.js
modernization pass, so later PRs in the campaign (and reviewers) can diff a
change against a known "before".

- **Taken from:** commit `c01dbc8d` (branch point `origin/main`)
- **Date:** 2026-07-17
- **Next.js:** 16.2.10 (Turbopack, the default `next build` bundler)

## What the numbers are

Each row is the total **client** JS (`.next/static/**/*.js`) reachable from a
route, in raw (uncompressed) and gzip bytes. Server/SSR chunks are excluded.

This is a superset of strict "First Load JS": it counts every client chunk in
the route's module graph, including lazily-imported ones that a strict
first-load figure would omit. It is used here because it is derived identically
for every measurement, so **before/after deltas are valid** even though the
absolute number runs higher than the historical Next route-table column.

### Why not `next build`'s route table

Next 16 no longer prints the Size / First Load JS columns in the `next build`
route table — neither the default Turbopack build nor `next build --webpack`
emits per-route sizes. `@next/bundle-analyzer` only instruments the webpack
builder (a no-op under the Turbopack production build) and would add a
dependency subtree. So the numbers here come from Next's own built-in analyzer,
`next build --experimental-analyze`, which writes per-route module/size data to
`.next/diagnostics/analyze/`; `scripts/analyze-bundle.mjs` sums the client
chunks from it. No new dependency.

## How to regenerate

```
npm run analyze
```

This runs `next build --experimental-analyze` and prints the per-route table via
`scripts/analyze-bundle.mjs`. It is intentionally separate from `build` /
`build:opennext`, so normal CI/dev builds never carry the analyzer cost. Update
the tables below (and the commit/date header) when re-measuring after a
bundle-weight PR lands.

`--experimental-analyze` is Turbopack-only: `next build` errors if a webpack
build (`--webpack`, or a `webpack` key in next.config) is ever introduced, and
the script exits non-zero if the analyzer stops emitting `analyze.data` —
neither can silently produce an empty table.

## Before — commit `c01dbc8d`

| Route | Client JS (raw) | Client JS (gzip) |
| --- | --- | --- |
| `/` | 1679.3 kB | 650.9 kB |
| `/login` | 1785.9 kB | 696.9 kB |
| `/live` | 1686.6 kB | 654.2 kB |
| `/playlists` | 1684.1 kB | 652.8 kB |
| `/dashboard/flowsheet` | 2187.6 kB | 884.8 kB |
| `/dashboard/catalog` | 1847.2 kB | 728.9 kB |
| `/dashboard/admin/roster` | 1808.8 kB | 710.6 kB |

## After — `experimental.optimizePackageImports: ["@mui/joy"]` (#962)

| Route | Client JS (raw) | Δ raw | Client JS (gzip) | Δ gzip |
| --- | --- | --- | --- | --- |
| `/` | 1679.3 kB | 0.0 kB | 650.9 kB | 0.0 kB |
| `/login` | 1785.9 kB | 0.0 kB | 696.9 kB | 0.0 kB |
| `/live` | 1686.6 kB | 0.0 kB | 654.2 kB | 0.0 kB |
| `/playlists` | 1684.1 kB | 0.0 kB | 652.8 kB | 0.0 kB |
| `/dashboard/flowsheet` | 2187.6 kB | 0.0 kB | 884.8 kB | 0.0 kB |
| `/dashboard/catalog` | 1847.2 kB | 0.0 kB | 728.9 kB | 0.0 kB |
| `/dashboard/admin/roster` | 1808.8 kB | 0.0 kB | 710.6 kB | 0.0 kB |

Output is byte-for-byte identical (same chunk sizes and same chunk counts on
every route). Turbopack already tree-shakes the `@mui/joy` barrel natively —
per-route sizes vary with actual usage, which only happens if the barrel is
being pruned — so `optimizePackageImports`, historically a webpack/SWC
barrel-rewrite optimization, has no measurable effect on the production
Turbopack build here. The config entry is still correct and worth keeping: it
satisfies the optimization for the webpack builder and matches Next's own
default handling of `@mui/material`/`@mui/icons-material`.

## After store scoping

The root layout previously mounted one combined 12-API store above every route.
Public surfaces now mount a reduced store (`lib/store-public.ts`:
authentication, application, experiences, flowsheet, playlist-search) and the
authenticated dashboard nests the full store (`lib/store.ts`) inside it. The
DJ-only feature graphs (admin roster, catalog, rotation, autoDJ, bin, metadata,
LML) no longer enter the `/`, `/live`, or `/playlists` client graphs.

| Route | Client JS (raw) | Δ raw | Client JS (gzip) | Δ gzip |
| --- | --- | --- | --- | --- |
| `/` | 1661.4 kB | −17.9 kB | 641.8 kB | −9.1 kB |
| `/login` | 1772.4 kB | −13.5 kB | 691.2 kB | −5.7 kB |
| `/live` | 1685.7 kB | −0.9 kB | 653.7 kB | −0.5 kB |
| `/playlists` | 1667.6 kB | −16.5 kB | 644.3 kB | −8.5 kB |
| `/dashboard/flowsheet` | 2214.0 kB | +26.4 kB | 897.3 kB | +12.5 kB |
| `/dashboard/catalog` | 1888.4 kB | +41.2 kB | 749.1 kB | +20.2 kB |
| `/dashboard/admin/roster` | 1834.3 kB | +25.5 kB | 722.7 kB | +12.1 kB |

Deltas are vs the committed `c01dbc8d` "Before" table above (same
`npm run analyze` method).

What the numbers do and don't show:

- The win on public routes is architectural first, bytes second. An analyzer
  source-graph audit confirms `/`, `/live`, and `/playlists` no longer include
  `lib/store.ts` or any of the admin/catalog/rotation/autoDJ/bin/metadata/LML
  RTK slices or APIs. Their byte cost is small relative to the MUI-Joy-dominated
  baseline, so removing them moves the analyzer total only modestly; on `/live`
  the removed code overlaps shared chunks it still loads for the flowsheet
  cluster it legitimately needs (live now-playing + SSE), so its byte total is
  nearly flat even though the modules are gone.
- `/live` and `/playlists` keep the public store, not zero Redux: `/live`'s
  `NowPlaying` uses the flowsheet RTK Query hooks and its `SSESubscription`
  drives the live-updates listener middleware; `/playlists` uses the
  playlist-search API. The public store is the union those surfaces need.
- `/login` still carries admin+bin+catalog because the shared logout helper
  `resetApplication` resets every slice and so references them; it is out of the
  public-route hot path targeted here and is security-sensitive (clears a prior
  user's state), so it was left as-is.
- Dashboard routes grow slightly. They now resolve two nested stores (the shell
  reads the public store; dashboard content reads the full store). The slice
  modules are shared between the two, so the net new code is the small
  `store-public` / provider modules; the larger swing is Turbopack
  re-attributing shared chunks across route graphs, not duplicated feature code.
  Dashboard behavior is unchanged.
