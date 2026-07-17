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
