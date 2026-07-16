# S15 — playlist-search-infinite-migration (OPTIONAL)

Status: pending, requires go/no-go with Jackson · Risk: risky (Opus) · PR: —

## Task

Migrate playlist search from its hand-rolled 3-effect accumulator to the proven
catalog `builder.infiniteQuery` pattern (cursor-based `getNextPageParam`).

## Go/no-go

Do this only if the `usePlaylistSearch` effect chain causes real defects or measurable
waste — census flags it as the superseded pattern, but it currently works. Decide with
Jackson at gate M4.

## Current problem

`src/hooks/playlistSearchHooks.ts` + `lib/features/playlist-search/api.ts` hand-roll
pagination accumulation through chained effects; catalog's `builder.infiniteQuery`
(`lib/features/catalog/`) is the stronger local pattern the census recommends as the
standard.

## Desired outcome

Playlist search on `builder.infiniteQuery`; effect chain deleted.

## Preserved behavior

#604 replace-vs-append semantics; #623 mid-flight deferral; empty-query default
listing. The 412-line playlistSearch test file is the spec — it must pass unweakened.

## Excluded scope

Catalog module itself; playlist UI beyond hook wiring.

## Verification

Baseline commands + full playlistSearch vitest suite.
