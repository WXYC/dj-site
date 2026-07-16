# DevX Refactor Campaign — Retrospective (2026-07-15 → 2026-07-16)

In-place, behavior-preserving refactor. Every slice: implemented by a dedicated
agent, independently reviewed by a fresh-context agent, verified (tsc / lint /
full vitest / build, e2e via CI), and merged as a single clean commit. The full
charter, census, slice specs, and per-slice review records live in git history
(`git log --follow docs/plans/devx-refactor/`, removed by the campaign-exit PR).

## What changed

- **Tests**: all 269 vitest files moved from colocated/`__tests__` locations into
  `tests/{unit,integration,contract}` with shared infra in
  `tests/{helpers,fakes,fixtures,setup}`; zero test weakened; counts ledgered
  every step (3,715 baseline → 3,673 at close: −52 verified-duplicate/dead,
  +16 added coverage, −7 removed-surface, +1 non-campaign merge).
- **Telemetry**: `posthog-js` fully contained in the `lib/posthog.ts` adapter
  (never-throw contract, tested); provider renamed `TelemetryProvider`.
- **State ownership**: org-role resolution deduped to one owner (N consumer
  mounts → 1 resolution); `useRegistry` referentially stable; admin roster moved
  onto RTK Query (pub/sub bus deleted); flowsheet search view/submit share one
  pipeline (#657-class divergence structurally impossible); bin toast-on-error
  effect → callback catch; vestigial rightbar Redux state deleted; experience id
  reads from the single SSR cookie prop.
- **Boundaries**: document shell server-rendered with providers inside `<body>`;
  `useSearchParams` Suspense-isolated; lml module self-contained (lib→src
  inversion fixed).
- **Tooling**: ESLint flat config + CI step (0 errors enforced; disabled rules
  carry rationale; 224-warning backlog tracked below).
- **Deletion**: dead hooks/providers/routes/deps removed throughout (incl.
  `useCanEditCatalog`, `roster-events` bus, `/api/experiences/active`, 5 npm
  deps).
- **Comments**: 3,115 → 2,607 lines; all issue-numbered/security/race rationale
  preserved; repo-wide pass verified semantically-null via the TypeScript
  compiler across every edited file.

## PR ledger

#882 docket · #884 ruleset · #885 S1 dead-code · #886 S2 telemetry · #887 S3 lml
· #889 S4 test-helpers · #892 S5 lib tests · #893 S6 hook/utility tests · #897 S7
component tests 1 · #899 S8 component tests 2 (arc close) · #900 S9 auth
ownership · #901 S10 flowsheet search · #902 S13 admin roster · #905 S11
rightbar/experience · #906 e2e hydration hotfix · #907 S14 comments ·
S15 → issue #883 · S16 declined · exit PR (this change).

## Signed-off behavior divergences (all disclosed in their PRs)

- **S9**: org-role freshness narrowed — cached per session (cleared on logout);
  a mid-session role change is seen on session refresh/reload, not remount.
  `useRegistry` with an empty-string user id yields `null` (stricter).
- **S12**: duplicate/StrictMode-double error toasts eliminated — exactly one
  toast per failed bin mutation.
- **S13**: roster remount within 60s serves RTKQ cache (in-app mutations still
  refetch via tags); `refetchOnMountOrArgChange: true` restores old behavior if
  wanted. ExportCSV now exports invalidation-fresh data (previously could be
  staler than the visible table).

## Known pre-existing issues filed during the campaign

#894 theme first-paint flash (no InitColorSchemeScript) · #895 GoLive aria-label
hydration mismatch · #896 BinContent Fragment `data-first-child` · #883
playlist-search infiniteQuery migration (deferred S15).

## Future-work backlog (advisories from reviews, none blocking)

- Lint warning backlog: 224 (dominated by `no-unused-vars`; also 16
  `exhaustive-deps`); consider warn→error ratchets as they're cleared.
- Hooks relocation (charter §7.1): `src/hooks/*` per-feature files could move
  into feature modules — deferred by owner decision at M5.
- CI grep guard against re-introducing colocated tests — proposed in #899,
  undecided.
- Dead code left out of scope: `switchExperience` mutation (zero callers), two
  unused `dynamic()` imports of ColorSchemeToggle in Header files.
- Test-infra barrel (`@/tests/helpers`) re-exports fakes/fixtures across
  directories — could be narrowed to direct imports.
- The jsdom `_location` teardown flake around `RotationEntryFields.refetch`
  (pre-dates campaign; intermittently fails focused-run exit codes).
- Non-top-level `vi.mock` warning in `FlowsheetBackendResult.test.tsx`.

## Durable standards

Distilled into `CLAUDE.md` ("Engineering standards") — adapters fail open, one
owner per value, effects for external sync only, comments state constraints,
deletion first-class, abstractions must pay for themselves.
