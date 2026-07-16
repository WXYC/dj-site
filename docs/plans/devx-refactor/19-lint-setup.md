# S19 — lint-setup

Status: reviewed, PR pending · Risk: simple-to-moderate (Sonnet, Opus review) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

Zero-source-edit override verified clean; disabled-rule inventory matches the config
exactly (spot-checked top-5 counts by re-enabling rules); deps confined to the eslint
devDependency tree (272 added, 2 benign transitive dedups, no prod version changes);
`react-hooks/rules-of-hooks` confirmed ON for production (test-scoped exception only);
lint 16s cold — fine for CI. Two supported findings applied post-review:

1. Reverted the CI job display-name rename (`Lint & Type Check` → back to
   `Type Check`) — branch protection matches required checks by name, and the
   workflow's own comment says a required check named "Type Check" exists; renaming
   could have wedged every future PR. The lint step stays, under the original name.
2. `react-hooks/purity` and `@typescript-eslint/no-non-null-asserted-optional-chain`
   downgraded from `off` to `warn` (4 findings surface as warnings; exit still 0) so
   NEW violations of these real-footgun rules stay visible. Post-change:
   0 errors / 228 warnings.
Added 2026-07-15 from charter §12/§14 (linting is a required verification step;
the repo has no lint configuration).

## Task

Add ESLint so the charter's per-slice "run linting" step is executable, and wire it
into scripts and CI.

## Current problem

No ESLint/Prettier/Biome config exists. CI's "Lint & Type Check" step runs only
`npx tsc --noEmit` (docs/ci-cd.md). The charter's slice workflow and completion
criteria require linting; today the step is vacuous.

## Desired outcome

- ESLint flat config: `eslint-config-next` (core-web-vitals) + TypeScript support.
- `npm run lint` script; CI step runs it (workflow edits must be pushed via SSH —
  tokens lack workflow scope).
- Existing violations triaged: fix mechanical/no-risk findings; for rules whose
  fixes would change behavior or create large churn, disable the rule with a
  one-line rationale in the config rather than scattering ignores. NO behavior
  changes ride this slice.
- docs/ci-cd.md and docs/development.md updated.

## Preserved behavior

All. Lint fixes must be provably behavior-neutral (unused imports, etc.); anything
ambiguous is disabled-with-rationale instead of fixed.

## Excluded scope

Prettier/formatting (separate decision, not this campaign); stylistic rule debates;
pre-commit hooks.

## Acceptance criteria

`npm run lint` exits 0 on the repo; config documents every disabled rule with a
reason; CI runs lint; subsequent slices add lint to their verification commands.

## Verification

Baseline commands + `npm run lint`; diff review confirms only lint-config,
mechanical fixes, scripts, docs, and CI changes.

## Result

**Orchestrator override applied to this slice.** The slice spec above calls for
triaging existing violations (fix mechanical/no-risk findings, disable-with-rationale
the rest). To keep this parallel devx-refactor track fully conflict-free with the
other worktree agents, the orchestrator overrode that clause: **this slice makes zero
edits to source files.** Every finding against the baseline codebase — including
purely mechanical ones like `prefer-const` and the ~10 stale `eslint-disable`
comments — is triaged entirely inside `eslint.config.mjs`, either disabled with a
one-line rationale or left as a live warning. No `app/`, `lib/`, `src/`, `e2e/`, or
`scripts/` file changed.

### Config shape

- `eslint.config.mjs`: flat config composed from `eslint-config-next/core-web-vitals`
  and `eslint-config-next/typescript` (both native flat-config arrays — no
  `FlatCompat`/`.eslintrc` shim needed).
- **`next lint` is gone in Next.js 16** — `node_modules/next/dist/cli/` has no
  `next-lint.js` at all. `package.json` script is `"lint": "eslint ."`.
- Global `ignores`: `.next/**`, `.next-*/**`, `.open-next/**`, `node_modules/**`,
  `coverage/**`, `e2e/playwright-report/**`, `e2e/test-results/**`, `e2e/.auth/**`,
  `.wrangler/**`, `public/**`, `next-env.d.ts`, `cloudflare-env.d.ts`.
- Three rule-override blocks, each with inline rationale comments:
  1. Global `rules` block — rules disabled repo-wide (real fix needs a source edit).
  2. `files: TEST_FILES` block (`**/*.test.{ts,tsx}`, `**/__tests__/**`, `e2e/**`,
     `tests/**`) — rules that are false positives against test/mock idioms,
     scoped off only there so the rule stays live for production code.
     (Originally `lib/test-utils/**` instead of `tests/**`; S4 moved that tree mid-
     flight and CI on the rebased branch caught the stale glob as 1 error in
     `tests/helpers/component-harness.ts` — fixed to cover the whole tests/ tree,
     which also future-proofs S6–S8.)
  3. `files: ["scripts/**/*.js"]` block — `no-require-imports` off for the one
     Node CJS script that legitimately uses `require()`.

### Deps added

`npm install --save-dev`:
- `eslint@^9.39.5` — pinned to the 9.x line, not the just-released 10.x. `eslint@10`
  resolved via plain `npm install eslint` but produced `ERESOLVE overriding peer
  dependency` warnings against `eslint-plugin-import`, `eslint-plugin-jsx-a11y`,
  `eslint-plugin-react`, and `typescript-eslint@8.46` — all of which cap their
  `eslint` peer range at `^9`. 9.x installs with zero peer warnings.
- `eslint-config-next@16.2.10` — pinned to the exact Next.js version in
  `package.json` (`^16.2.10`), matching the pattern the package itself uses
  (`eslint-config-next`'s own version tracks `next`'s).
- Transitively pulls `@next/eslint-plugin-next`, `eslint-plugin-react`,
  `eslint-plugin-react-hooks` (v7 — includes the new React Compiler readiness
  rules), `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `typescript-eslint`,
  `globals`, and the import resolvers. `allow-scripts` warnings on install
  (esbuild/core-js/workerd/msw/sharp/unrs-resolver) are expected and ignored per
  the task instructions.
- `npm audit` reports 6 pre-existing vulnerabilities (defu, dompurify, form-data,
  postcss, yaml) — all transitive deps of `better-auth`, `posthog-js`,
  `@opennextjs/cloudflare`, `@vitejs/plugin-react`, and `next` itself, unrelated to
  the eslint packages added here. Not touched (out of scope; `npm audit fix --force`
  would downgrade `next` to `9.x`).

### Disabled/scoped-rule inventory (baseline counts, before any override)

Baseline run (`eslint-config-next` config, zero rule overrides) against the whole
repo: **380 errors, 217 warnings** across 179 files. Every error below is accounted
for by a disable or a test/script scope (358 + 20 + 2 = 380); every remaining
warning-only rule is left enabled.

Disabled repo-wide (errors; real fix is a source-file change, out of scope):

| Rule | Count | Representative files |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 295 (44 prod / 251 test) | `lib/features/session.ts`, `lib/store.ts`, `lib/features/authentication/*.ts`, `src/hooks/authenticationHooks.ts`, 19 prod files total + test/mock files |
| `react/no-unescaped-entities` | 20 | `EntryForm.tsx`, `SearchForm.tsx`, `EmailChangeModal.tsx`, `NotFoundCard.tsx` |
| `react-hooks/set-state-in-effect` | 17 | `useMediaQuery.ts`, `useCanEditCatalog.ts`, `adminHooks.ts`, flowsheet/login components |
| `react-hooks/refs` | 15 | `StoreProvider.tsx`, `ThemePicker.tsx`, `playlistSearchHooks.ts`, `themePreferenceHooks.ts` |
| `prefer-const` | 4 | `adminHooks.ts`, `djHooks.ts`, `RequiredBox.tsx` |
| `react-hooks/preserve-manual-memoization` | 3 | `catalogHooks.ts`, `flowsheetHooks.ts`, `playlistSearchHooks.ts` |
| `react-hooks/purity` | 2 | `Quotes/Forgot.tsx`, `Quotes/HoldOn.tsx` |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | 2 | `binHooks.ts` |

Scoped off for `TEST_FILES` only (errors; false positives against test/mock idioms,
rule stays active for production code):

| Rule | Count | Representative files |
|---|---|---|
| `react/no-children-prop` | 7 | `component-harness.ts`, `adminHooks.test.ts`, `useSSEConnection.test.tsx` |
| `react-hooks/rules-of-hooks` | 5 | `e2e/fixtures/auth.fixture.ts` (Playwright `use` fixture), `queue/page.test.tsx` (inline mock component) |
| `@next/next/no-assign-module-variable` | 4 | `theme.test.ts` (×2 experiences) |
| `@typescript-eslint/no-unsafe-function-type` | 3 | `switch.test.ts`, `rightbar.test.ts`, `session.test.ts` |
| `react/display-name` | 1 | `useCatalogQueryResults.test.tsx` |

Scoped off for `scripts/**/*.js` only:

| Rule | Count | Representative files |
|---|---|---|
| `@typescript-eslint/no-require-imports` | 2 | `scripts/post-build.js` |

Left **enabled** (warning-level; doesn't fail `npm run lint`, kept visible as backlog):

| Rule | Count | Notes |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 188 | Dominated by intentionally-unused destructured props/catch bindings, but real dead code is mixed in — needs a source pass to sort out. |
| `react-hooks/exhaustive-deps` | 16 | Classic dep-array gaps across hooks and components. |
| `@next/next/no-img-element` | 8 | All in production files (`AlbumArtAndIcons.tsx`, `SongEntry.tsx`, etc.) — candidates for `next/image` migration. |
| `import/no-anonymous-default-export` | 1 | `open-next.config.ts`. |
| `jsx-a11y/alt-text` | 1 | `AlbumErrorCard.tsx`. |
| (unused `eslint-disable` directives) | ~10 | `linterOptions.reportUnusedDisableDirectives` flat-config default (`"warn"`); stale disable comments left over from before this config existed, or made stale by the rule-off decisions above. Mechanical one-line removals, blocked by the zero-source-edit override this slice. |

### Follow-up tightening list (future slices)

1. **`no-explicit-any` sweep** (largest item by far) — 44 production-file findings
   across 19 files, concentrated in `lib/features/authentication/`, `lib/store.ts`,
   `lib/features/session.ts`, `lib/features/flowsheet/{conversions,frontend}.ts`.
   Directly serves the charter's "adapter-boundary types, not `any`" goal. The 251
   test/mock findings are lower priority (stub typing).
2. **React Compiler readiness rules** (`react-hooks/set-state-in-effect`,
   `react-hooks/refs`, `react-hooks/purity`, `react-hooks/preserve-manual-memoization`
   — 37 findings total) — each needs the actual hook body read, not a mechanical
   rewrite; overlaps directly with charter §7 hook-audit priorities. Good candidates
   to fold into S9-S13 (the hook-ownership slices) rather than a standalone slice.
3. **`react/no-unescaped-entities`** (20) — pure mechanical `&apos;`/`&rsquo;` escapes,
   zero risk, good first PR for whoever picks up source triage.
4. **`prefer-const`** (4) + **`no-non-null-asserted-optional-chain`** (2, `binHooks.ts`)
   — small, mechanical-to-low-risk.
5. **`no-unused-vars`** (188 warnings) — needs a pass to separate "intentionally
   unused, rename to `_foo`" from actual dead code.
6. **`no-img-element`** (8 warnings, all production) — evaluate `next/image`
   migration per component; some may have a deliberate reason to opt out
   (external/unsized artwork).
7. **Stale `eslint-disable` comments** (~10) — delete once the rules they guarded
   are either fixed or their disables consolidated into this config.
8. **`react-hooks/exhaustive-deps`** (16 warnings) — case-by-case; some may be
   intentional (see the `#611` comment already in `themePreferenceHooks.ts`
   guarding a similar effect-timing decision).

### Verification

- `npm run lint`: exit 0 (0 errors, 224 warnings — matches the "left enabled" table
  above: 188 + 16 + 8 + 1 + 1 + 10 ≈ 224, the small variance from the 217-warning
  baseline is newly-surfaced "unused eslint-disable directive" warnings created by
  the rule-off decisions themselves).
- `npx tsc --noEmit`: clean.
- `npm run test:run`: 269 files / 3,670 tests, all passing — matches the required
  count exactly. One pre-existing unhandled jsdom error (`_location` null in an
  animation-frame callback, this run surfacing via
  `joinShow.optimistic.test.ts` rather than `RotationEntryFields.refetch.test.tsx`
  — same known flake class noted in `00-campaign.md`, not introduced here).
- `npm run build`: succeeds (Turbopack, all routes compiled).

### CI

`.github/workflows/ci.yml`'s `typecheck` job (display name changed from
"Type Check" to "Lint & Type Check" to match `docs/ci-cd.md`'s existing description)
gained a `Lint` step (`npm run lint`) before the existing `Type check` step. Job id,
`needs:`, and `if:` guard are unchanged. `dorny/paths-filter`'s `app_source` filter
already includes `'*.config.*'`, so a PR touching only `eslint.config.mjs` still
triggers this job.

### Deviations from the slice spec

- **Zero source edits** instead of "fix mechanical/no-risk findings" — orchestrator
  override for parallel-track conflict-freedom (see top of this section). Every
  finding, mechanical or not, is disabled/scoped in config rather than fixed in
  source.
- Warning-level rules with findings are left **enabled** rather than
  disabled-with-rationale, since they don't block `npm run lint`'s exit code and
  stay useful as a visible backlog. The acceptance bar ("`npm run lint` exits 0")
  doesn't require them to be silenced, and the task's "every disabled rule is
  documented" is met — none of these were disabled.
