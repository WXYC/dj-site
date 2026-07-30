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

## Catalog strict first-load: composition and the motion/qrcode.react/posthog-js absence proof

Taken from commit `086196fd` (branch point `origin/main`), measured 2026-07-29, same Next.js 16.2.10 Turbopack production build as above. This section uses a narrower, more precise metric than the "Client JS (raw)" table above: the analyzer total is a superset of every chunk in a route's module graph including lazily-imported ones (39 static chunks for `/dashboard/catalog` in this build), while the figures below count only the chunks Next's own client-reference-manifest lists as reachable from the catalog route's initial render, which is the strict first-load set and the same set this repo's `scripts/check-catalog-first-load.mjs` guard inspects.

`/dashboard/catalog`'s client-reference-manifest (`.next/server/app/dashboard/@modern/catalog/page_client-reference-manifest.js`, and identically the `@classic` sibling) references 29 real chunk files under `.next/static/chunks`, summing to 1,117.8 kB of raw emitted JS. Attributing each chunk's bytes to a dependency via its source map's `sourcesContent` (see method below) puts MUI at roughly 43.9% of that total across six sub-packages (`@mui/joy` 26.2%, `@mui/base` 7.2%, `@mui/material` 4.8%, `@mui/system` 4.1%, `@mui/utils` 0.9%, `@mui/icons-material` 0.7%), first-party application source (everything under `app/`, `lib/`, `src/` outside `node_modules`) at 19.8%, the Next.js framework chunk (which also carries Next's vendored React/React DOM runtime under `next/dist/compiled`) at 12.4%, `@reduxjs/toolkit` at 6.3%, and `react-redux` at 2.6%. The remainder is a long tail of smaller dependencies (`@popperjs/core`, `@wxyc/shared`, `sonner`, `better-auth`, `immer`, emotion internals, and similar) each under 2.2% individually.

Neither `motion` (framer-motion) nor `qrcode.react` nor `posthog-js` contributes any bytes to that 29-chunk set, on either the `@modern` or `@classic` catalog manifest, confirming they are already fully isolated from catalog's first load by Turbopack's automatic per-route code-splitting rather than by any explicit dynamic-import boundary in source. `motion` lives in two chunks of 146,199 bytes (~142.8 kB) each, referenced by the flowsheet route's `@modern`, `@classic`, `@entries`, and `@queue` client-reference-manifests and nothing else — not catalog, not login, not any public route. `qrcode.react` lives in a single 26,374-byte (~25.8 kB) chunk referenced only by the six `login/*` route-state manifests (`@modern`/`@classic` crossed with `@newuser`/`@normal`/`@reset`). `posthog-js` itself (the actual npm package, ~967 kB of source text across the maps that reference it) is absent from every catalog chunk; the only PostHog-related source reachable from catalog's first load is the 4,385-byte first-party adapter `lib/posthog.ts`, which is exactly the pattern this repo's engineering standards require (external services sit behind an application-owned adapter) and which itself dynamically imports the real `posthog-js` library elsewhere rather than pulling it into every route that can call it.

Method: for each catalog manifest, extract every `static/chunks/<name>.js` reference (regex over the manifest file is sufficient; no need to parse it as JS), then for each named chunk read its real file, find its trailing `//# sourceMappingURL=` comment, and load the map that comment names — not the map obtained by string-substituting `.js` for `.js.map` on the chunk's own name. Turbopack emits many orphan `.js.map` files with no same-named `.js` chunk (67 of 68 map files in this build have no matching chunk by naive substitution), so a chunk's actual map is whatever its own sourceMappingURL comment points at, frequently a different basename entirely. Each map's `sourcesContent` array gives the original (pre-minification) source text for every entry in `sources`; summing the character length of entries whose source path contains a `motion-dom`/`framer-motion`/`/motion/` or (case-insensitively) `qrcode` marker, per chunk, is what both this section's composition numbers and the guard script's pass/fail decision are built on. `sourcesContent` text length is a proxy for relative composition, not an exact minified-byte count (original source is naturally larger than what ships), which is why the composition percentages above are computed from a larger nominal total than the 1,117.8 kB headline figure; the headline figure itself comes straight from the real chunk files' byte sizes on disk, not from source maps.

`scripts/check-catalog-first-load.mjs` is the regression guard that keeps this true going forward: it runs in CI (`.github/workflows/ci.yml`, the `build` job) against every real production build and fails loudly, naming the offending chunk and dependency, if a future change ever makes catalog's first load reachable from a motion- or qrcode.react-bearing chunk again.
