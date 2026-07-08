# Flowsheet Smart Entry (v2)

The v1 redesign (segmented four-field bar, commit `7a11e72b`) was rejected:
clunky/dated feel plus hard breakage (mobile submit unwired, track-picker
feature dropped with a failing e2e spec, visual verification that never ran).
v2 is a total overhaul on the same branch: a single continuous **smart sentence
input** (Todoist Quick Add style) that parses trigger words and semicolon syntax
into a pending flowsheet entry while driving the existing four-source search.

Visual north star: `src/components/experiences/modern/flowsheet/DesignSandboxModal.tsx`
(reference mockup — no sandbox constants/fake data reach production; deleted in
final cleanup).

## Binding decisions (Jackson, 2026-07-08)

1. Results stay in the **Popper overlay** (floats over queue/entries, no page
   layout shift); catalog-style expand/contract animates the panel + composer.
2. **All four result sources** stay: bin / rotation / catalog / library, as
   sentence rows.
3. **One responsive component** for mobile (no summary-button/fullscreen modal).
4. Composer is a **wrapping `<textarea>` + mirrored highlight layer**.
5. **No feature flag** — each phase leaves the branch/PR preview deployable.
6. Design/feel is the primary success criterion.

## Parsing model

- Trigger words: `off`→song, `by`→artist, `on`/`in`→album, `via`/`with`→label.
  Recognized only as standalone words with trailing whitespace; leading text is
  the song (track-first default); first assignment wins.
- Semicolon default order: `Track; Artist; Album; Label` (any prefix); hybrid —
  first segment parses with triggers, later segments fill next default field.
- State pieces kept distinct: raw text · provisional ghost completion · passively
  detected spans · locked/accepted tokens · selected catalog/rotation result ·
  escaped/suppressed trigger interpretations.
- Ghost accepted on Right Arrow/End at caret end → **locks** the field (becomes a
  search constraint that exact-matches). Editing inside a locked span breaks the
  value equality and auto-unlocks.
- Escape ladder (one rung/press): dismiss ghost → suppress newest trigger →
  clear selected match → clear locks + collapse panel → clear input.

## Invariants that must never break

`convertQueryToSubmission` #701 (album_id>0 gate), `withSanitizedAlbumLinkage`
#702/#703, selection-change clears `track_position` #704, Ctrl/⌘ queue race
guard, flush-then-`store.getState()` submit, SWR from `data`+`isFetching`,
click-away closes only. Never: Tab-hijack ghost accept, `disablePortal`,
`!important`, document-level arrow listeners.

Anti-repeat of v1: every e2e spec uses the auth fixture; component tests render
real children via `renderWithProviders`; visual verification actually runs;
dead code deleted the phase it's orphaned; testids unique; mobile submit proven.

## Phase progress

- [x] **P0** — Checkpoint mockup/polish; fix the two e2e specs that never
  authenticated (baseline-capture, keyboard-entry); skip the track-picker spec
  (points at dead code; un-skips when v2 reintroduces track picking).
- [x] **P1** — Port #589/#944 coverage onto live `RotationBrowse` +
  `normalizeTrackArtists` unit test; delete the orphaned v0 component tree
  (17 files).
- [x] **P2** — Parser (`SmartEntry/parser/*`) + `buildPendingQuery` + slice
  groundwork (`setParsedFields`, `selectedMatch`, `search.filters`; retired dead
  `rotationMode` reducers). 51 pure unit tests; full suite green (3338).
- [x] **P3** — Composer (textarea + mirror), toolbar, submit; swapped the mount;
  deleted the old entry components (results tree kept for P4 rework). Visually
  confirmed (alignment + colours); review polish applied — commit buttons moved
  into the composer row, focus ring added, "Start typing…" placeholder, and
  "from" accepted as an album connector.
- [x] **P4** — Results panel: sentence rows, card-catalog album art, metadata
  pills, promoted selected match, keyboard nav, Popper that reads as a
  continuation of the composer with a continuous active outline. Review polish
  applied (selection visibility, Ctrl+Enter queue + success ring, connected
  panel, refocus reopens results).
- [x] **P5** — Ghost text (artist/song/album via override) accepted with Right
  Arrow/End, field locking as search constraints, Escape rung-1 dismissal.
  Chained song→album ghost deferred.
- [x] **P6** — Album-first search parity (/library/query), genre/format/rotation
  filters, and track picking off the selected match (sets track_position;
  track-picker e2e rewritten + un-skipped). The rotation-scope browse cascade
  was dropped by decision — the rotation-bin filter covers it, so the
  All/Rotation toggle was removed. Extensive composer/results/toolbar review
  polish applied.
  - **P8 cleanup note:** ScopeControl and RotationBrowse (and the old v1 results
    tree: FlowsheetResultsListbox, BackendResults, NewEntryRow, matchHighlight)
    are now orphaned by the v2 SmartResults + the scope-toggle removal; delete
    them in P8 (and reassess the slice `scope`/`setSearchScope`/rotation-metadata
    reducers). #589/#944: v2 track picking uses SelectedMatchTracks (own #589
    refetch guard); normalizeTrackArtists is no longer on the live path.
  - **First task — album-first search parity.** Album-first input (`from
    <album>`) returns no results because the flowsheet's catalog source uses the
    old artist-centric `/library/` endpoint (`useSearchCatalogQuery`), while the
    card catalog uses `/library/query` (`searchLibraryQuery`) with `album:"…"`
    syntax and searches album/artist/label symmetrically. The frontend already
    issues album-only queries correctly (LML `?title=…`, catalog `album_title`,
    bin/rotation term filter) — the gap is the endpoint. Fix: switch
    `useCatalogFlowsheetSearch` to build a `q` (`artist:"…" AND album:"…"`) and
    call `searchLibraryQuery`, extracting `data.results`; update its tests;
    verify album-first results against the backend.
- [x] **P7** — Responsive layout (verified on narrow viewports), the action-
  cluster declutter (idle: break/talkset; composing: clear/queue/play), and the
  e2e hardening: FlowsheetPage + all specs migrated to the composer, track-picker
  un-skipped, duplicate-testid guard.
- [~] **P8** — Cleanup: deleted the orphaned v1 tree (ScopeControl, RotationBrowse,
  TrackPickerDropdown, old FlowsheetResultsListbox/BackendResults/NewEntryRow/
  matchHighlight, flowsheetSearchBarStyles, normalizeTrackArtists) + the
  DesignSandboxModal; removed the dead slice machinery (scope/staged/confirmed/
  freeze). Remaining: comment trim (ongoing), axe pass, screenshot matrix.
  Possible follow-up: catalog-style animations (Jackson may request).

Full plan detail: `~/.claude/plans/you-are-planning-an-glittery-comet.md`.
