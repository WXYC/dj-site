# S8 — tests-components-move-2

Status: reviewed, PR pending · Risk: simple (Sonnet) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

Heaviest 5 sibling-mock files verified against production imports; zero surviving
relative specifiers repo-wide; bracket-dir (`[...path]`) and `@slot` paths all
resolve (no `@/`-alias collision); RotationEntryFields.refetch moved with only its
SUT import changed (flake untouched); EmailChangeModal pure R100 rename; find-proof
empty; ledger reconciled 272 − 3 = 269. Advisories (pre-existing, out of scope):
the jsdom `_location` flake exits nonzero on focused runs; a non-top-level vi.mock
in FlowsheetBackendResult.test.tsx warns — both carried unmodified, future cleanup.

## Task

Move the remaining colocated tests: modern-experience components and `app/` routes and
pages. Completes the test migration.

## Desired outcome

Tests under `src/components/experiences/modern` → `tests/integration/components/modern/...`;
`app/**/__tests__` route-handler tests → `tests/integration/routes/`; page/layout tests →
`tests/integration/app/`; `tests/components/EmailChangeModal.test.tsx` re-homed into the
same buckets. After S8: zero colocated tests repo-wide (e2e/, scripts/ exempt — see S16
and census §4).

## Preserved behavior

Moves + import fixes only.

## Excluded scope

Production code; e2e/; scripts bats suites.

## Acceptance criteria

`find app src lib -name "*.test.*" -o -name "__tests__" -type d` returns nothing; all
272-ledger files accounted for across S4–S8; count preserved. Propose (not implement)
a CI grep guard in the PR description for Jackson's call.

## Verification

Baseline commands; final ledger reconciliation recorded in this file.

## Result

Moves + import fixes only, no test content changed. Ledger preserved exactly: 269 test
files / 3,674 tests, pre and post (full `npm run test:run` both before and after the
moves). `npx tsc --noEmit` clean. `npm run lint`: 0 errors, 226 warnings (unchanged
baseline noise — pre-existing unused-var warnings in the moved files' own bodies,
carried with them; no new findings from the specifier edits). `npm run build`
succeeds. Focused `npx vitest run tests/integration`: 161 files / 1,699 tests, all
green. Known noise: the jsdom `_location` flake in
`RotationEntryFields.refetch.test.tsx` did not reproduce in this run's full-suite pass
(it's non-deterministic, documented since S1); the file moved unmodified except its
own SUT import, per instruction — not chased, out of scope.

Every relative specifier fix was computed mechanically: for each moved file, the
script resolved its original (pre-move) `./`/`../` specifiers against the file's old
directory to an absolute repo path, verified a file exists there (trying
`.tsx`/`.ts`/`.jsx`/`.js` and `index.*` candidates), and only then rewrote the
specifier to the `@/`-aliased form of that verified path. 0 of 163 specifiers failed
resolution, so every rewritten import/`vi.mock` is proven — by file-existence check
against the untouched production tree — to still name the same module it named before
the move.

### Move map

**`src/components/experiences/modern/**` (colocated + `__tests__/`, `experiences/`
dropped, `modern` kept lowercase per S7 convention)** →
`tests/integration/components/modern/**` (101 files, `__tests__/` flattened into the
mirrored feature directory; includes the re-homed stray, see below):

- admin/roster/ (colocated + `__tests__/`): AccountEditForm, AccountSearchForm,
  csvImport, ImportCSVModal, NewAccountForm, RosterTable, AccountEntry (from
  `__tests__/`), ExportCSV (from `__tests__/`)
- autoDJ/: AutoDJBanner, AutoDJGreyscale
- catalog/Results/ (from `__tests__/`): MatchedTrackChips, MobileResult,
  ReleaseChips, Result
- catalog/Search/: catalogFilterChipStyles, catalogTagFilters, Filters,
  QueryBuilder, SearchBar
- flowsheet/: AddToQueueButton, FlowsheetSkeletonLoader, GoLive, InfiniteScroller,
  RemoveFromQueueButton
- flowsheet/Entries/ (colocated + `__tests__/`): DraggableEntryWrapper, Entry,
  MessageEntry, SkeletonEntry (DraggableEntryWrapper's `__tests__/` duplicate
  flattened into the same directory)
- flowsheet/Entries/Components/: DateTimeStack, DragButton, RemoveButton
- flowsheet/Entries/SongEntry/: FlowsheetEntryField, MobileSongEntry, SongEntry,
  usePlayNow
- flowsheet/Search/: BreakpointButton, FlowsheetSearchbar, FlowsheetSearchInput,
  LibraryTrackPicker, RotationBinSelector, RotationEntryFields,
  RotationEntryFields.refetch (known flake, moved unmodified in behavior),
  RotationModeToggle, RotationReleaseDropdown, TalksetButton, TrackPickerDropdown
- flowsheet/Search/Results/: FlowsheetSearchResults
- flowsheet/Search/Results/BackendResults/: FlowsheetBackendResult,
  FlowsheetBackendResults
- flowsheet/Search/Results/NewEntry/: NewEntryPreview
- Header/: DesktopHeader, MobileHeader, PageHeader
- Leftbar/: FlowsheetLink, Leftbar, LeftbarContainer, LeftbarLink, LeftbarLogout
- login/: AuthLinkSessionGuard
- login/Forms/: AuthBackButton, EmailOTPForm, LoginFormSwitcher, NewUserForm,
  OnboardingForm, OTPCodeForm, QRCodeForm, RequestPasswordResetForm,
  ResetPasswordForm, UserPasswordForm
- login/Forms/Fields/: RequiredBox, ValidatedSubmitButton
- login/Layout/: Background, Footer, Header, Main
- login/Quotes/: Forgot, HoldOn, Welcome
- Main.test.tsx (root)
- Rightbar/: NowPlayingContent, RightBarContentContainer, Rightbar,
  RightbarContainer, RightbarMiniSwitcher, RightbarMobileClose,
  RightbarPanelContainer
- Rightbar/Bin/: BinContent, BinEntry, BinEntryActions, BinEntryContextMenu,
  ClearBinButton, ExportBinButton, useBinEntryActions
- Rightbar/panels/: AccountEditPanel
- Rightbar/panels/album/: AlbumCard, LibraryStatus, StreamingLinks, Tracklist
- settings/: SettingsInput, **EmailChangeModal** (re-homed stray, see below)

`app/api/**/__tests__` and `app/auth/**/__tests__` (route-handler tests) →
`tests/integration/routes/**` (4 files, `__tests__/` flattened):

- `app/api/experiences/__tests__/switch.test.ts` → `tests/integration/routes/api/experiences/switch.test.ts`
- `app/api/view/__tests__/rightbar.test.ts` → `tests/integration/routes/api/view/rightbar.test.ts`
- `app/auth/[...path]/__tests__/route.test.ts` → `tests/integration/routes/auth/[...path]/route.test.ts`
- `app/auth/verify-email/__tests__/route.test.ts` → `tests/integration/routes/auth/verify-email/route.test.ts`

`app/**` page/layout tests (colocated + one `__tests__/`) →
`tests/integration/app/**` (7 files, joining `ThemedLayout.test.tsx` already there
from S6 — same bucket, same precedent):

- `app/dashboard/@classic/playlists/__tests__/page.test.tsx` → `tests/integration/app/dashboard/@classic/playlists/page.test.tsx`
- `app/dashboard/@modern/flowsheet/@queue/page.test.tsx` → `tests/integration/app/dashboard/@modern/flowsheet/@queue/page.test.tsx`
- `app/login/@classic/ClassicLoginSlotSwitcher.test.tsx` → `tests/integration/app/login/@classic/ClassicLoginSlotSwitcher.test.tsx`
- `app/login/LoginBounceTelemetry.test.tsx` → `tests/integration/app/login/LoginBounceTelemetry.test.tsx`
- `app/login/@modern/LoginSlotSwitcher.test.tsx` → `tests/integration/app/login/@modern/LoginSlotSwitcher.test.tsx`
- `app/login/@modern/@normal/page.test.tsx` → `tests/integration/app/login/@modern/@normal/page.test.tsx`
- `app/login/SessionEndedNotice.test.tsx` → `tests/integration/app/login/SessionEndedNotice.test.tsx`

Top-level `src/components/*.test.tsx` (S7 review advisory, explicitly named) →
`tests/integration/components/` root (2 files, placement documented per advisory —
these have no experience/purpose segment, so they land directly under the
`components/` bucket rather than a synthetic subdirectory):

- `src/components/LoadingPage.test.tsx` → `tests/integration/components/LoadingPage.test.tsx`
- `src/components/NotFoundCard.test.tsx` → `tests/integration/components/NotFoundCard.test.tsx`

Pre-campaign stray, re-homed (1 file, folded into the modern count above):

- `tests/components/EmailChangeModal.test.tsx` → `tests/integration/components/modern/settings/EmailChangeModal.test.tsx`
  (its production file is `src/components/experiences/modern/settings/EmailChangeModal.tsx`,
  so it belongs in the `modern/settings` bucket, not a standalone one). This file
  already imported production code and its own mocks via `@/...` aliases (it was a
  pre-existing top-level test, not colocated) — its move required **no specifier
  changes at all**. The now-empty `tests/components/` directory was removed with the
  move.

Total: 114 files moved (101 modern-experience incl. the re-homed stray + 4 routes +
7 app pages/layouts + 2 top-level components). Every emptied `__tests__/` directory
(3 under `modern/`, 4 under `app/`) was removed once flattened.

### vi.mock / import repoints — resolution verification

None of the production components moved; only their tests moved. 163 relative
specifiers (`from "./..."`, `from "../..."`, `vi.mock("./...")`, `vi.mock("../...")`)
were rewritten to `@/`-aliased absolute-module-id form across 108 of the 114 moved
files (the other 6 — including the route-handler tests, which already used
`await import("@/app/...")` dynamic imports with alias paths, and the re-homed
`EmailChangeModal.test.tsx` — had zero relative specifiers to begin with and needed
no content change; `git diff --shortstat` confirms 163 insertions / 163 deletions,
symmetric one-line-per-specifier).

16 files needed sibling `vi.mock` repoints beyond their own SUT import (multi-mock
files, verified each against the production component's own import lines):

| Test file | # specifiers | Sibling mocks repointed | Resolves to (verified against production import) |
|---|---|---|---|
| `Rightbar/Rightbar.test.tsx` | 8 | `RightbarMobileClose`, `RightbarContainer`, `NowPlayingContent`, `Bin/BinContent`, `panels/AlbumDetailPanel`, `panels/SettingsPanel`, `panels/AccountEditPanel` + SUT | `Rightbar.tsx` imports each from the identical relative specifier, resolved to `@/src/components/experiences/modern/Rightbar/*` — same files |
| `flowsheet/Search/FlowsheetSearchbar.test.tsx` | 7 | `BreakpointButton`, `TalksetButton`, `FlowsheetSearchInput`, `Results/FlowsheetSearchResults`, `RotationModeToggle`, `RotationEntryFields` + SUT | `FlowsheetSearchbar.tsx` imports each from the same relative path under `flowsheet/Search/` — same files |
| `flowsheet/Entries/SongEntry/MobileSongEntry.test.tsx` | 7 | `usePlayNow`, `FlowsheetEntryField`, `SongEntryControls`, `SongEntryStatusChips`, `../Components/RemoveButton`, `../dragContext` + SUT | `MobileSongEntry.tsx` imports each identically, `../Components/RemoveButton` and `../dragContext` resolve up to `flowsheet/Entries/{Components,dragContext}` — same files |
| `Leftbar/Leftbar.test.tsx` | 6 | `LeftbarContainer`, `LeftbarLink`, `FlowsheetLink`, `LeftbarSettingsButton`, `LeftbarLogout` + SUT | `Leftbar.tsx` imports each from `./*` under `Leftbar/` — same files |
| `Rightbar/panels/album/AlbumCard.test.tsx` | 5 | `DiscogsMarkupRenderer`, `LibraryStatus`, `StreamingLinks`, `Tracklist` + SUT | `AlbumCard.tsx` imports each from `./*` under `Rightbar/panels/album/` — same files |
| `Rightbar/Bin/BinEntry.test.tsx` | 5 | `../../catalog/ArtistAvatar`, `useBinEntryActions`, `BinEntryActions`, `BinEntryContextMenu` + SUT | `BinEntry.tsx` imports `ArtistAvatar` from `../../catalog/ArtistAvatar` (resolves to `modern/catalog/ArtistAvatar`), the rest from `./*` — same files |
| `Rightbar/Bin/BinContent.test.tsx` | 5 | `../RightBarContentContainer`, `BinEntry`, `ClearBinButton`, `ExportBinButton` + SUT | `BinContent.tsx` imports `RightBarContentContainer` from one level up (`Rightbar/`), the rest from `./*` — same files |
| `flowsheet/Entries/SongEntry/SongEntry.test.tsx` | 5 | `../Components/DragButton`, `../Components/RemoveButton`, `../DraggableEntryWrapper`, `FlowsheetEntryField` + SUT | `SongEntry.tsx` imports the `../Components/*` pair and `../DraggableEntryWrapper` up one level to `Entries/`, `FlowsheetEntryField` from `./` — same files |
| `flowsheet/Search/Results/FlowsheetSearchResults.test.tsx` | 4 | `BackendResults/FlowsheetBackendResults`, `NewEntry/NewEntryPreview`, `../LibraryTrackPicker` + SUT | `FlowsheetSearchResults.tsx` imports each identically, `../LibraryTrackPicker` resolves up to `flowsheet/Search/` — same files |
| `flowsheet/Entries/MessageEntry.test.tsx` | 4 | `Components/DragButton`, `Components/RemoveButton`, `DraggableEntryWrapper` + SUT | `MessageEntry.tsx` imports each from `./*` under `Entries/` — same files |
| `flowsheet/Entries/Entry.test.tsx` | 4 | `SongEntry/SongEntry`, `MessageEntry`, `Components/DateTimeStack` + SUT | `Entry.tsx` imports each from `./*` under `Entries/` — same files |
| `Rightbar/NowPlayingContent.test.tsx` | 3 | `RightBarContentContainer`, `RightbarMiniSwitcher` + SUT | `NowPlayingContent.tsx` imports both from `./*` — same files |
| `Rightbar/Bin/BinEntryContextMenu.test.tsx` | 2 | `useBinEntryActions` + SUT | `BinEntryContextMenu.tsx` imports it from `./useBinEntryActions` — same file |
| `Rightbar/Bin/BinEntryActions.test.tsx` | 2 | `useBinEntryActions` (type import) + SUT | `BinEntryActions.tsx` imports the type from `./useBinEntryActions` — same file |
| `flowsheet/Search/Results/BackendResults/FlowsheetBackendResults.test.tsx` | 2 | `FlowsheetBackendResult` + SUT | `FlowsheetBackendResults.tsx` imports it from `./FlowsheetBackendResult` — same file |
| `flowsheet/Entries/DraggableEntryWrapper.test.tsx` | 2 | `dragContext` + SUT | `DraggableEntryWrapper.tsx` imports it from `./dragContext` — same file |

The remaining 92 moved files with relative specifiers needed only their own SUT
import corrected (single specifier, `./Component` or `../Component`), each verified
present via the mechanical resolve-and-check script described above (e.g.
`src/components/experiences/modern/admin/roster/AccountEditForm.tsx`,
`src/components/experiences/modern/catalog/Results/Result.tsx`,
`app/dashboard/@classic/playlists/page.tsx`, etc.). The `[...path]` and
`verify-email` route tests, and `EmailChangeModal.test.tsx`, needed zero changes
(already alias-based).

### Counts

- Pre-move: 269 test files / 3,674 tests (full `npm run test:run`).
- Post-move: 269 test files / 3,674 tests (full `npm run test:run`) — identical.
- Acceptance find-proof — `find app src lib -name '*.test.*' -o -type d -name '__tests__'`
  → **empty** (zero colocated tests repo-wide, e2e/ and scripts/ exempt per census §4).
- `find tests/components` → no such directory (removed).
- `find tests/integration/components/modern -name '*.test.*' | wc -l` → 101.
- `find tests/integration/components -maxdepth 1 -name '*.test.*' | wc -l` → 2
  (LoadingPage, NotFoundCard).
- `find tests/integration/routes -name '*.test.*' | wc -l` → 4.
- `find tests/integration/app -name '*.test.*' | wc -l` → 8 (7 moved this slice +
  `ThemedLayout.test.tsx` from S6).
- Focused `npx vitest run tests/integration`: 161 files / 1,699 tests, all passing.

### CI grep guard (proposed, not implemented — Jackson's call)

Now that S8 closes the migration, a CI step could enforce the invariant going
forward:

```sh
# fails the build if any colocated test or __tests__ dir reappears under
# production source roots
if find app src lib -name '*.test.*' -o -type d -name '__tests__' | grep -q .; then
  echo "Colocated tests found outside tests/ — see CLAUDE.md #Tests" >&2
  exit 1
fi
```

Candidate placement: a step in the existing lint/test CI job (added in S19), before
or alongside `npm run lint`. Not added in this slice — scope is moves only; left for
Jackson to fold into CI configuration on his own schedule.
