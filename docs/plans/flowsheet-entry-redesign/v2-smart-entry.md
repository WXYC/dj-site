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
- [ ] **P6** — Filters, rotation scope, track picking (un-skip track-picker).
- [ ] **P7** — Responsive + e2e hardening (mobile submit).
- [ ] **P8** — Cleanup + audit (delete sandbox, retire stagedRelease, docs).

Full plan detail: `~/.claude/plans/you-are-planning-an-glittery-comet.md`.
