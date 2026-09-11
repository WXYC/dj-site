# Back from an archived show keeps the listing (dj-site#1430)

## The bug in one line

Opening a show from a Previous Sets result unmounts the listing, and the listing's scroll offset and its accumulated pages both go with it — so the feature's core loop (scan, open, back, open the next) works exactly once.

## What actually composes badly

Three separate things, and only the third is a real trade-off:

1. **Modern's listing owns an inner scrollport.** `Results.tsx` renders rows inside `Box ref={scrollRef}` with `flex: 1; minHeight: 0; overflowY: auto`. Nothing restores an inner scroller — the browser restores *document* scroll on popstate, and the App Router adds nothing (it leaves `history.scrollRestoration` at `auto`; the `experimental.scrollRestoration` flag is Pages Router only). A remounted inner scroller starts at `scrollTop: 0`.

2. **The listing is unmounted, not hidden.** Both surfaces branch three ways on `selectedShowId`, so opening a show removes the listing from the tree.

3. **The pages are held by a 60-second timer that starts at that unmount.** `searchPlaylists` sets no `keepUnusedDataFor`, so RTK's default 60s runs from the moment the last subscriber goes away. Inside the window `refetchOnMountOrArgChange: true` re-runs *every accumulated page* against `/flowsheet/search` on the way back in; past it the entry is gone and the listing restarts at page 1. Reading a show usually takes longer than a minute, so a DJ walking ten plays pays one of those two prices ten times.

**Classic does not ride window scroll, and the issue's cause is wrong about this.** `InfiniteScroll` observes the viewport, which is what made it look that way, but `html, body` clip their overflow and `src/styles/globals.css` puts the scrollport back on the shell's `#classic-container`. The document cannot scroll at all, so `window.scrollY` is always 0 and there is no browser restore to inherit — classic loses its offset on every Back, inside the retention window and out. It was caught by the e2e assertion written against the issue's premise: pagination advanced while `window.scrollY` stayed 0. Classic shares (1) as well as (2) and (3); only the identity of the scrollport differs.

## The decision

**Hold the search subscription above the branch, and scope the cache entry's life to the surface instead of to a clock.**

The surface components (`PreviousSetsSurface`, `ClassicPreviousSetsSurface`) already stay mounted across the show/listing branch: the row links are query-only navigations on the same route, `cacheComponents` is off so Next is not swapping routes under `<Activity>`, and React reconciles the surface by position and type. Calling the search hook *there* means the RTK cache entry is never unsubscribed while the visitor is anywhere on the playlists screen. The accumulated pages therefore survive a show visit of any length, and the retention window stops being the thing that decides.

That unlocks the rest:

- **`keepUnusedDataFor: 0`** on `searchPlaylists`. With the subscription held by the surface, the entry's life is exactly the surface's life. Zero retention means leaving the screen drops the pages, so the next arrival has nothing cached to serve or to re-walk and fetches a genuinely fresh page 1.
- **`refetchOnMountOrArgChange: true` goes away.** Its comment is right that the archive gains entries continuously and a fresh arrival must not serve a stale page 1 — but the flag bought that freshness by refetching *the whole accumulated walk* on every mount, which is the cost this issue is about. Zero retention delivers the same freshness as a lifetime rather than as a refetch: there is no stale entry left to serve.
- **Modern retains its inner scroller's offset** in a ref held above the branch, restored in a layout effect on the listing's mount and recorded in that effect's cleanup.
- **Classic gets the same offset treatment**, against `#classic-container` instead of the listing's own box. Both experiences share one hook, `useRetainedScrollOffset`; the scrollport's identity is the only difference between them.

A property worth naming, because it shapes the tests: zero retention makes the failure mode **immediate rather than time-dependent**. If the held subscription were broken, a Back after one second would lose the pages just as surely as a Back after two minutes. The quick-Back case becomes the *strict* test, and the 60-second dwell becomes the easy one.

### Rejected: keep `<Results>` mounted and hide it

Cheapest to write, and it sidesteps retention the same way — but it cannot keep the offset it exists to keep. `display: none` destroys the scrollable area and every engine resets `scrollTop` with it. `visibility: hidden` keeps a layout box, but only if the element stays in flow, and in flow it would displace the show view; taken out of flow, its scrollport is sized by the show view's box rather than its own, so the maximum `scrollTop` changes underneath a deep offset and clamps it. It also parks a second full table in the DOM behind every show, and turns a clean three-way branch into a two-of-three-visible one.

React's `<Activity mode="hidden">` is available (React 19.2) and does not rescue this: it hides with `display: none` *and* runs effect cleanups, so it would drop the RTK subscription as well — losing both halves at once.

### Rejected: move the scrollport to the window

Most aligned with classic, and the router/browser would restore it natively. But there is no window scroll to move to: the dashboard shell (`Main`) is `height: 100dvh; overflow: hidden`, which is why `ShowView` carries its own scrollport and says so. Moving the listing to window scroll means changing the shell's layout contract for every modern page, and it inherits classic's version of the problem anyway — the restore only lands if the pages are back, so the retention question survives the move.

### Classic scope: covered here

Covered rather than filed separately, and more of it than planned: classic turned out to need the offset half too. Filing that separately would have left classic holding its pages and still losing the reader's place — a half-fix in the experience the station's librarian actually uses. Its e2e coverage asserts the offset and the request count.

## Changes

### `lib/features/playlist-search/api.ts`

Add `keepUnusedDataFor: 0` to `searchPlaylists`, with the reasoning above stated as a constraint (the entry is surface-scoped; retention past the last unsubscribe costs freshness and buys nothing).

### `src/hooks/playlistSearchHooks.ts`

- Extract the query-arg derivation (`effectiveQuery`, `isPartialQuery`, `queryArg`) into an internal hook so the subscription and the consumers cannot drift about *which* entry they mean.
- Drop `refetchOnMountOrArgChange: true` from `usePlaylistSearch`, replacing the comment with what now provides freshness.
- Add `usePlaylistSearchSubscription(listingVisible: boolean)`: subscribes to the same entry and holds it. It latches on `listingVisible` — before the listing has ever been on screen it skips, so a permalink straight to `?show=<id>` (or to the week grid) does not fire a listing search that nobody asked for. The latch is a ref written during render, the same monotonic idiom `usePlaylistSearchResults` already uses for `seedRetired`.

### `src/components/experiences/modern/previous-sets/PreviousSetsSurface.tsx`

Call the subscription hook above the branch, and hold `const listingScrollTop = useRef(0)` there; pass it to `<Results>`.

### `src/components/experiences/modern/previous-sets/Results/Results.tsx`

Accept the retained offset — **optional**, keeping the existing `= {}` default, because `Results.test.tsx` renders a bare `<Results />` in ten places and a required prop would fail the typecheck across all of them. That spec mocks `usePlaylistSearchResults`, so the new layout effect does run there; it is inert, because jsdom has no layout behind `scrollTop`, and it should not be mistaken for coverage.

In a `useLayoutEffect`, restore the offset on mount and record `scroller.scrollTop` in the cleanup. Layout-effect cleanup runs before React detaches the node, so the read is of a still-attached, still-scrolled element. The rows are in the cache at remount, so they are present in the same commit the restore runs after — no waiting on row height, which is what makes this a plain effect rather than the deferred-frame dance `useScrollToShowEntry` needs.

### `src/hooks/useRetainedScrollOffset.ts`

The restore/record pair, shared by both listings once classic turned out to need it too. It takes a resolver rather than a ref because classic's scrollport belongs to the shell above the tree, and holds that resolver in a ref so an inline arrow cannot become an effect dependency — re-running the restore every render would fight the reader for the scrollbar.

### `src/components/experiences/classic/playlists/`

`ClassicPreviousSetsSurface` calls the subscription hook above the branch and holds the offset ref beside it, exactly as modern does; `PreviousSetsContainer` consumes it against `#classic-container`.

## Tests

Request counts in vitest against the MSW fakes; scroll in Playwright, because they are layout claims jsdom cannot make (`Element.scrollTop` has no layout behind it there).

**vitest** — a new `tests/integration/components/experiences/modern/previous-sets/PreviousSetsSurface.test.tsx` (none exists) and additions to the existing `tests/integration/components/classic/playlists/ClassicPreviousSetsSurface.test.tsx`; the two experiences keep their differing test paths. Both use `renderWithProviders(…, { store })` per the repo rule, a real store, `playlistSearchFake({ archiveSize })` via `server.use`, and `fake.requests` as the counter. Two harness details the specs need: the `@/lib/features/authentication/client` mock `playlistSearchPagination.test.tsx:13-19` uses, because `backendBaseQuery` fetches a JWT; and a **mutable** `next/navigation` mock — a module-level `URLSearchParams` the test reassigns before `rerender`, since the existing classic surface test's fixed `new URLSearchParams()` cannot flip the `show` param.

1. Back from a show does not re-run the search. The walk is asserted as `{ page, cursor }` pairs, not page numbers: the slice's default sort is `date`, which `isCursorPaginated` routes to the cursor branch, so a second page is `{ page: 0, cursor: "after:<lastRowId>" }` and an assertion of `[0, 1]` would be wrong for the default listing (compare `playlistSearchPagination.test.tsx:76-80`).
2. The same with the show left open past the retention window. With `keepUnusedDataFor: 0` that window is zero, so the dwell is no longer the interesting variable — but the criterion is asserted literally with `vi.useFakeTimers({ shouldAdvanceTime: true })`, the flavour this repo already uses where MSW and fake timers meet, advancing 61s.
3. A fresh arrival fetches a fresh page 1: unmount the surface entirely, remount, assert a new first-page request appears. Note that RTK schedules removal on a `setTimeout` even at `keepUnusedDataFor: 0`, so this asserts through `waitFor` rather than synchronously — and the quick-Back assertions in (1) must not accidentally depend on that 0ms removal *not* having flushed.
4. A permalink straight to `?show=<id>` records no request at all; navigating from it to the listing records the first page. This pins the latch, the one piece of new behaviour a reader would not predict.
5. `tests/unit/hooks/playlistSearchHooks.test.ts` carries the flag in five places — the `let` at :16, the mock's option type at :36, the capture at :40, the reset at :76, and the assertion at :98-105. All five go; the surviving property ("a fresh arrival fetches page 1") is what (3) asserts, behaviourally, against a real store.

**Playwright** — a new `e2e/tests/playlists/previous-sets-back.spec.ts`, following `playlist-search.spec.ts` and `show-scroll.spec.ts`: both stub the backend with `page.route`, so the archive depth is the test's to choose rather than the seeded database's. `wheelUntil` (mirroring `show-scroll.spec.ts:60-78`) drives real scrolling — `scrollIntoView` moves an `overflow: hidden` box just as happily and so proves nothing. Reading the modern scroller's offset needs a stable handle, so the scrollport gets a `data-testid`; `getByRole("table")`'s parent is not a handle worth depending on.

6. Modern (`dj2.json`): wheel the listing past its first page, open a show, Back — the scroller is at the offset it was left at and the rows below the fold are still there.
7. Back/forward/back lands on the same offset.
8. Classic: the same claim against window scroll, in its own `test.describe` under `classicDj.json`. The skin is an account field, not a cookie, so `dj2.json` would silently render the modern slot and the test would pass against the wrong surface.
9. A request counter over `**/flowsheet/search**` asserts the real router agrees with the vitest claim — this is the only test that exercises the assumption below.

## Risks

- **The surface staying mounted is the load-bearing assumption.** It follows from same-route query navigation plus React reconciliation, with `cacheComponents` off so Next is not swapping routes under `<Activity>` — but it is an assumption about a framework, not about this code, and the vitest tests cannot see it because they drive the branch by hand. Test (9) is what actually proves it, so it gets written and run against a real browser *first*, before the rest is built on top. If it were false, `keepUnusedDataFor: 0` would leave the quick-Back case worse than today, and the fix would have to hoist the subscription somewhere that does survive.
- **`/playlists` shares the data layer.** The public archive page renders a different tree (`modern/playlist-search/PlaylistSearchContainer`) over the same endpoint and the same hook, so it inherits the retention change. It has no show branch and mounts once, so the behaviour it sees is unchanged — but its tests run in the same suite and are the tripwire if that reasoning is wrong.
