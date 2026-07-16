# S4 — tests-helpers-move

Status: reviewed, PR pending · Risk: simple, bulk mechanical (Sonnet) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking issues

All 8 checks CONFIRMED-SAFE (codemod sampled across all 5 specifier variants — import
lines only; no unintended rewrites, no orphaned vi.mock paths; barrel export set
byte-identical; no circular imports; msw lifecycle identical; coverage-exclude drop
verified correct; e2e relative path resolves; sha256 OK; full run 269/3,670). The
docs-history deviation was judged acceptable — all four residual strings are
audit-trail, none operational. Advisory for campaign close: consumers importing fakes
and fixtures through the `@/tests/helpers` barrel obscure the new taxonomy at call
sites; a future pass could narrow them to direct `@/tests/fakes|fixtures` imports.

## Task

Move the shared test infrastructure from `lib/test-utils/` into the top-level tests
hierarchy and codemod all importers. Must precede S5–S8.

## Current problem

CLAUDE.md mandates `tests/{helpers,fakes,fixtures}`; today the shared render helpers,
harnesses, msw handlers, and fixture factories live in `lib/test-utils/` and 116 files
(measured) import `@/lib/test-utils`.

## Desired outcome

`lib/test-utils/*` → `tests/helpers/` (render, harnesses, time); msw handlers →
`tests/fakes/`; fixture factories → `tests/fixtures/`. All 116 importers codemodded to
the new specifiers (prefer codemod over a re-export shim; if a shim is used it is
deleted in this same slice). `vitest.setup.ts` moves to `tests/setup/` (charter §5.2)
with `vitest.config.mts` setupFiles + coverage excludes updated; `docs/testing.md`
pointers updated.

## Preserved behavior

No test weakened; msw lifecycle unchanged; charset fixture hash intact. Diff is large
but uniform — a moves PR.

## Excluded scope

No test file moves other than `lib/test-utils` itself (S5–S8 handle test files); no
helper API changes.

## Acceptance criteria

`lib/test-utils/` gone; zero `@/lib/test-utils` imports remain; full run passes with
the SAME file/test count as the post-S1 ledger.

## Verification

Baseline commands; record pre/post test counts in this file.

## Result

### Move map

`git mv` (all as pure renames except where a follow-up edit was required for an
internal cross-reference, noted below):

| From (`lib/test-utils/`) | To |
|---|---|
| `render.tsx` | `tests/helpers/render.tsx` |
| `constants.ts` | `tests/helpers/constants.ts` |
| `time.ts` | `tests/helpers/time.ts` |
| `time.vitest.ts` | `tests/helpers/time.vitest.ts` |
| `slice-harness.ts` | `tests/helpers/slice-harness.ts` |
| `api-harness.ts` | `tests/helpers/api-harness.ts` |
| `component-harness.ts` | `tests/helpers/component-harness.ts` |
| `conversion-harness.ts` | `tests/helpers/conversion-harness.ts` |
| `index.ts` | `tests/helpers/index.ts` (edited — barrel now re-exports fakes/fixtures) |
| `msw/handlers.ts` | `tests/fakes/handlers.ts` |
| `msw/server.ts` | `tests/fakes/server.ts` |
| `fixtures.ts` | `tests/fixtures/fixtures.ts` (edited — internal imports repointed) |
| `charset-torture.ts` | `tests/fixtures/charset-torture.ts` (edited — corpus path simplified, same target file) |
| (repo root) `vitest.setup.ts` | `tests/setup/vitest.setup.ts` (edited — msw server import + two comments repointed) |

`tests/fixtures/` already held `charset-torture.json` + `.sha256`; both untouched
byte-for-byte (`sha256sum -c` still passes from `tests/fixtures/`). `lib/test-utils/`
(including the `msw/` subdirectory) no longer exists.

Category placement followed the slice description literally: `constants.ts` and the
harnesses/render/time files went to `tests/helpers/` (general test infrastructure,
not fixture *data* or msw config); `msw/handlers.ts` + `msw/server.ts` flattened
(dropped the `msw/` segment) into `tests/fakes/`; `fixtures.ts` (the factory
functions) and `charset-torture.ts` (the charset-corpus loader, tightly coupled to
the `charset-torture.json` fixture it reads) both went to `tests/fixtures/`.

`tests/helpers/index.ts` keeps the single barrel so 97 of the 116 importers needed
only a bare specifier swap; it now re-exports across directories (`../fakes/server`,
`../fakes/handlers`, `../fixtures/fixtures`) to preserve that one-import ergonomic
rather than splitting every barrel consumer into multiple import lines. No re-export
shim at the old `lib/test-utils` path was created at any point — the codemod ran
directly against the new specifiers.

### Codemod

New specifier mapping (derived from the 5 specifier variants actually in use,
measured via `grep -rhoE '@/lib/test-utils[a-zA-Z0-9/_.-]*'` before the move):

| Old specifier | New specifier | Files |
|---|---|---|
| `@/lib/test-utils` (barrel) | `@/tests/helpers` | 97 |
| `@/lib/test-utils/render` | `@/tests/helpers/render` | 23 |
| `@/lib/test-utils/fixtures` | `@/tests/fixtures/fixtures` | 4 |
| `@/lib/test-utils/msw/server` | `@/tests/fakes/server` | 3 |
| `@/lib/test-utils/charset-torture` | `@/tests/fixtures/charset-torture` | 1 |

**116 files codemodded** — matches the slice spec's 116-file estimate exactly.
Applied via a `perl -pi` pass ordered longest-specifier-first so the bare-barrel
substitution couldn't clobber an already-rewritten longer path. Diff per file is 1
import line changed (2 files touch two different specifiers, so 2 lines) — no other
content in any of the 116 files was modified.

One additional import was **not** part of the 116 (it used a relative path, not the
`@/` alias, so the earlier `@/lib/test-utils` grep didn't catch it):
`e2e/fixtures/auth.fixture.ts` imported `../../lib/test-utils/fixtures` directly
(e2e/ has its own `tsconfig.json` with no path aliases) — repointed to
`../../tests/fixtures/fixtures`.

### Config changes

- `vitest.config.mts`: `setupFiles` now points at `./tests/setup/vitest.setup.ts`.
  Coverage `exclude` dropped `**/test-utils/**` entirely rather than rewriting it —
  coverage `include` is `["lib/**/*", "src/**/*"]`, and none of the new locations
  (`tests/helpers`, `tests/fakes`, `tests/fixtures`, `tests/setup`) fall under either
  glob, so the exclude pattern was dead weight after the move, not something to
  relocate. `**/__tests__/**` exclude is untouched (still live — those directories
  aren't part of this slice).
- No `tsconfig.json` change needed: `@/*` already maps to the repo root, so
  `@/tests/...` resolves without a new path entry.
- No `package.json` / eslint / other config referenced `test-utils`.

### Docs

- `docs/testing.md`: `## Test Utilities (lib/test-utils/)` section retitled and
  repointed to `tests/helpers/` + the `@/tests/helpers` barrel; added a line noting
  the barrel spans `tests/helpers/` + `tests/fakes/` + `tests/fixtures/`; the MSW
  handlers pointer now reads `tests/fakes/handlers.ts`; setup-file mention now reads
  `tests/setup/vitest.setup.ts`.
- `docs/architecture.md`: removed the `lib/test-utils/` line from the `lib/` tree and
  expanded the `tests/` tree entry to list `helpers/`, `fakes/`, `fixtures/`,
  `setup/`.
- `docs/test-fixtures.md`: not touched — its `test-utils` reference is
  `wxyc-shared/src/test-utils/wxyc-example-data.json`, a different (workspace)
  package, out of scope.

**Deviation — historical docs not scrubbed.** Four files still contain the literal
string `lib/test-utils`: `docs/plans/devx-refactor/census.md` (labeled read-only,
2026-07-15 snapshot — S1 set the precedent of leaving deleted-path references in this
file, e.g. it still names `app/StoreProvider.tsx`), `docs/plans/devx-refactor/00-campaign.md`
(the S4 row's one-line scope description, `lib/test-utils → tests/{helpers,fakes,fixtures}`
— an arrow-notation description of the move, not a live pointer), `docs/plans/devx-refactor/03-lml-module-consolidation.md`
(S3's own completed Result section, describing a change it made to
`lib/test-utils/fixtures.ts` before this slice existed), and this file's own
`## Task` / `## Current problem` / `## Desired outcome` sections above (left
unedited, matching the S1 pattern of not rewriting a slice doc's pre-implementation
prose after the fact). None of these are operational pointers a developer would
follow into stale code — all four are audit-trail / plan-history text. Flagging this
against the literal "grep returns zero hits repo-wide (code, config, docs)" wording
in case the reviewer wants those scrubbed too; the operational docs
(`docs/testing.md`, `docs/architecture.md`) and all code/config are clean.

### Measured pre/post counts

- Pre-slice (`main`-equivalent working tree before this slice's edits):
  `npx tsc --noEmit` clean; `npm run test:run` → **269 files / 3,670 tests, all
  passing** (matches the campaign's post-S1 ledger this slice spec targets).
- Post-slice: `npx tsc --noEmit` clean; `npm run test:run` → **269 files / 3,670
  tests, all passing** — exact match, zero drift. `npm run build` succeeds (20
  routes generated, no errors).
- Pre-existing jsdom `_location` unhandled-rejection noise during
  `RotationEntryFields.refetch.test.tsx` did not reproduce in the post-slice run (it's
  timing-flaky, not deterministic); this is the documented pre-existing issue, not a
  regression, and doesn't affect the reported pass/fail counts either way.
- `sha256sum -c tests/fixtures/charset-torture.json.sha256` (run from
  `tests/fixtures/`): `charset-torture.json: OK`.
- Repo-wide `grep -rn "@/lib/test-utils"` (code/config, all extensions): zero hits.
  `grep -rln "lib/test-utils"`: four hits, all in `docs/plans/devx-refactor/`
  historical/plan docs — see deviation note above.

### Excluded-scope compliance

No helper API changed (every moved file's exports are byte-identical to before,
aside from the internal import-path edits enumerated above). No test file moved
other than the `lib/test-utils/` contents themselves. No comment-sweep on the 116
codemodded files — each has exactly its import line(s) changed. Comment reduction
was applied only to the moved helper files themselves, per the charter: trimmed
section-announcement comments (`// Constants`, `// Fixtures`, `// MSW server and
handlers`, etc.) from `tests/helpers/index.ts`, which restates what the `export *`
lines already say.
