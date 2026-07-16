# S7 — tests-components-move-1

Status: reviewed, PR pending · Risk: simple (Sonnet) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

All 8 sibling-mock repoints verified against production import lines; zero surviving
relative specifiers across the 46 moved files; 64/64 diff lines confirmed
specifier-only; convention spot-checks pass; ledger re-verified 269/3,670; lint
0 errors. Two advisories handed to S8: (1) keep the literal-casing bucket rule
(`modern` lowercase, as `Layout` kept its capital); (2) S8's move-map must
explicitly name `src/components/LoadingPage.test.tsx` and
`src/components/NotFoundCard.test.tsx` — its acceptance find-sweep catches them,
but its enumeration didn't.

## Task

Move component tests for shared/widgets/Layout/classic into `tests/integration/`.

## Desired outcome

Tests under `src/components/shared`, `src/widgets`, `src/Layout`, and
`src/components/experiences/classic` → `tests/integration/components/...`, mirroring
source paths under the purpose bucket (census §4 mapping rules).

## Preserved behavior

Moves + import fixes only.

## Excluded scope

Modern-experience and `app/` tests (S8).

## Acceptance criteria

No colocated tests remain under the four named roots; count preserved vs ledger.

## Verification

Baseline commands; count recorded pre/post.

## Result

Moves + import fixes only, no test content changed. Ledger preserved exactly:
269 test files / 3,670 tests, pre and post (full `npx vitest run` both before and
after the moves). `npx tsc --noEmit` clean. `npm run lint`: 0 errors, 228 warnings
(unchanged from the pre-existing baseline — no new findings in touched files).
`npm run build` succeeds. Focused `npx vitest run tests/integration/components`:
46 files / 521 tests, all green. Known noise: the jsdom `_location` flake in
`RotationEntryFields.refetch.test.tsx` still surfaces during the full run — that
file lives under `src/components/experiences/modern/`, untouched, S8 scope.

### Convention decision

Census §4 proposes `tests/integration/components/<experience>/<feature>/…`. This
slice's four roots split into two cases:

- `src/components/experiences/classic/**` has a real experience segment: the
  `experiences/` wrapper is dropped as noise and `classic` becomes the top-level
  bucket under `components/`, i.e. `tests/integration/components/classic/<feature>/…`
  (feature = `catalog`, `flowsheet`, `login/...`, `playlists`).
- `src/components/shared`, `src/widgets`, `src/Layout` have no experience segment.
  Per the task's own worked example
  (`src/widgets/NowPlaying/X.test.tsx` → `tests/integration/components/widgets/NowPlaying/X.test.tsx`),
  these three roots keep their own top-level source directory name as the bucket
  and otherwise mirror the source path unchanged:
  `tests/integration/components/shared/…`, `tests/integration/components/widgets/…`,
  `tests/integration/components/Layout/…` (original casing preserved to match the
  source directory exactly).

**Convention for S8**: `tests/integration/components/<root-name-or-experience>/<mirrored-subpath>`,
where `<root-name-or-experience>` is the experience id when the source path has an
`experiences/<id>/` segment (drop `experiences/`), otherwise the literal top-level
source directory name (`shared`, `widgets`, `Layout`, and for S8: `modern`, `app`
routes stay under their own `tests/integration/routes|app` per census, not this
bucket). `__tests__/` segments are always flattened (files land directly in the
mirrored directory, no `__tests__` in the target path).

### Move map

`src/components/shared/**` (colocated, root + `Authorization/`, `Branding/`,
`General/`, `Theme/`, `layouts/`) → `tests/integration/components/shared/**`
(16 files, subdirs mirrored):

- root: ExperienceProvider.test.tsx, ExperienceSwitch.test.tsx,
  SSESubscription.test.tsx, SSEConnectionIndicator.test.tsx,
  PageTitleUpdater.test.tsx
- Authorization/: AuthorizedView.test.tsx
- Branding/: Logo.test.tsx
- General/: LinkButton.test.tsx
- Theme/: Appbar.test.tsx, AppbarWrapper.test.tsx, ColorSchemeToggle.test.tsx,
  ThemeSwitcher.test.tsx, ThemePicker.test.tsx
- layouts/: AppShell.test.tsx, NavContainer.test.tsx, PageContainer.test.tsx

`src/widgets/NowPlaying/**` (colocated) → `tests/integration/components/widgets/NowPlaying/**`
(6 files): AlbumArtAndIcons.test.tsx, EntryText.test.tsx,
GradientAudioVisualizer.test.tsx, index.test.tsx, Main.test.tsx, Mini.test.tsx.

`src/Layout/*.test.tsx` (colocated) → `tests/integration/components/Layout/**`
(5 files): Background.test.tsx, Footer.test.tsx, Header.test.tsx, Main.test.tsx,
WXYCPage.test.tsx.

`src/components/experiences/classic/**` (colocated + `__tests__/`, `experiences/`
dropped) → `tests/integration/components/classic/**` (19 files, `__tests__/`
flattened into the mirrored feature directory):

- catalog/ (from `__tests__/`): SearchForm.test.tsx,
  SearchResults.exclusive.test.tsx, SearchResults.matchedVia.test.tsx,
  SearchResults.test.tsx
- flowsheet/ (from `__tests__/`): ActionsBar.test.tsx, EntryActionMenu.test.tsx,
  EntryForm.test.tsx, EntryRow.test.tsx, EntryTable.test.tsx, StartShow.test.tsx
- login/Forms/: UserPasswordForm.test.tsx
- login/Forms/Fields/ (colocated): RequiredBox.test.tsx,
  ValidatedSubmitButton.test.tsx
- login/Layout/ (colocated): Header.test.tsx, Main.test.tsx
- playlists/ (from `__tests__/`): PreviousSetsContainer.test.tsx,
  ResultRow.test.tsx, ResultTable.test.tsx, SearchForm.test.tsx

Total: 46 files moved (16 + 6 + 5 + 19). Both empty `__tests__/` directories
under `classic/catalog`, `classic/flowsheet`, `classic/playlists` were removed by
`git mv` once emptied. No test content changed in any file — every diff line is
a specifier substitution (46 files, 64 insertions / 64 deletions, symmetric).

### vi.mock / import repoints — resolution verification

None of the 34 moved production components moved; only their tests moved. Every
moved test's relative `vi.mock(...)`/SUT import (all `./sibling` or `../sibling`
forms, since these tests sat 1–2 directories from their SUT) became an
`@/src/...` alias resolving to the identical absolute file. 8 files needed
sibling `vi.mock` repoints beyond the SUT import itself; the rest needed only
the SUT import corrected. Verified for each against the production file's own
import line:

| Test file | vi.mock/import changed | Resolves to (verified against production import) |
|---|---|---|
| `Layout/WXYCPage.test.tsx` | SUT `./WXYCPage`; `vi.mock("./Background")`, `vi.mock("./Header")`, `vi.mock("./Main")`, `vi.mock("./Footer")` → `@/src/Layout/*` | `WXYCPage.tsx:2-5` imports each from `./Background`/`./Header`/`./Main`/`./Footer` relative to `src/Layout/` — same files |
| `shared/Theme/Appbar.test.tsx` | SUT `./Appbar`; `vi.mock("./ThemeSwitcher")`, `vi.mock("./ThemePicker")` → `@/src/components/shared/Theme/*`; `vi.mock("../General/LinkButton")` → `@/src/components/shared/General/LinkButton` | `Appbar.tsx:7-9` imports `LinkButton` from `"../General/LinkButton"` (relative to `Theme/`, resolves to `shared/General/LinkButton`), `ThemePicker`/`ThemeSwitcher` from `./ThemePicker`/`./ThemeSwitcher` — same files |
| `shared/Theme/AppbarWrapper.test.tsx` | `vi.mock("./Appbar")`, `vi.mock("./AppbarClassic")` → `@/src/components/shared/Theme/*`; SUT `./AppbarWrapper` | `AppbarWrapper.tsx:5-6` imports `Appbar` from `./Appbar` and `AppbarClassic` from `./AppbarClassic`, both relative to `Theme/` — same files |
| `widgets/NowPlaying/Main.test.tsx` | `vi.mock("./AlbumArtAndIcons")`, `vi.mock("./EntryText")`, `vi.mock("./GradientAudioVisualizer")` → `@/src/widgets/NowPlaying/*`; SUT `./Main` | `Main.tsx:14-16` imports each of the three from the matching relative specifier under `widgets/NowPlaying/` — same files |
| `widgets/NowPlaying/Mini.test.tsx` | same three sibling mocks + SUT `./Mini` → `@/src/widgets/NowPlaying/*` | `Mini.tsx:17-19` imports the same three siblings — same files |
| `widgets/NowPlaying/index.test.tsx` | SUT `./index` → `@/src/widgets/NowPlaying`; `vi.mock("./Main")`, `vi.mock("./Mini")` → `@/src/widgets/NowPlaying/Main`/`Mini` | `index.tsx:9-10` imports `NowPlayingMain` from `./Main` and `NowPlayingMini` from `./Mini` — same files |

All other moved tests (40 files) needed only their own SUT import corrected —
no sibling `vi.mock`, single relative specifier per file (`./Component` or
`../Component` for the `__tests__/`-nested classic tests), each verified to
resolve to the production file's own location (confirmed present via direct
file-existence check against every target path, e.g.
`src/components/shared/ExperienceProvider.tsx`,
`src/components/experiences/classic/flowsheet/EntryForm.tsx`, etc.).

### Counts

- Pre-move: 269 test files / 3,670 tests (full `npx vitest run`).
- Post-move: 269 test files / 3,670 tests (full `npx vitest run`) — identical.
- `find src/components/shared src/widgets src/Layout src/components/experiences/classic -name '*.test.*' -o -type d -name '__tests__'`
  → empty.
- `find tests/integration/components -name '*.test.*' | wc -l` → 46.
- Focused `npx vitest run tests/integration/components`: 46 files / 521 tests, all
  passing.
