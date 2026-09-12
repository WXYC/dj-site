import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import {
  DOM_DEPENDENT_LIB_TESTS,
  DOM_FREE_TIERS,
  widenTierGlobToAnyTsFile,
} from "./tests/setup/vitest-projects.ts";

// `next lint` was removed in Next.js 16 (no `next/dist/cli/next-lint.js`
// anymore); `eslint-config-next` now ships native flat-config arrays
// (`/core-web-vitals`, `/typescript`) instead of the old FlatCompat/eslintrc
// shim, so no compatibility layer is needed here.

const TEST_FILES = [
  "**/*.test.{ts,tsx}",
  "**/__tests__/**/*.{ts,tsx}",
  "e2e/**/*.{ts,tsx}",
  // The whole tests/ tree is test infrastructure (helpers, fakes, fixtures,
  // setup) — the S4-S8 migration moves test code here from lib/ and src/.
  "tests/**/*.{ts,tsx}",
];

// Every re-export the barrel offers, with the RTL-free deep path that
// replaces it. render.tsx, field-value.ts, and component-harness.ts are
// deliberately absent — the node project has no RTL-free path to them, since
// importing any of the three pulls in @testing-library/react.
const BARREL_BAN_MESSAGE =
  "Import fixtures from @/tests/fixtures/fixtures, constants from @/tests/helpers/constants, time utilities from @/tests/helpers/time.vitest, describeConversion from @/tests/helpers/conversion-harness, server from @/tests/fakes/server, createTestStore from @/tests/helpers/store, describeSlice from @/tests/helpers/slice-harness, describeApi from @/tests/helpers/api-harness, handlers from @/tests/fakes/handlers, libraryTracksHandler/ONE_TRACK from @/tests/fakes/libraryTracks, and fakeRotationEndpoints/fakeRotationEndpointsWithGatedKill from @/tests/fakes/rotation instead of the @/tests/helpers barrel.";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      ".open-next/**",
      "node_modules/**",
      "coverage/**",
      "e2e/playwright-report/**",
      "e2e/test-results/**",
      "playwright-report/**",
      "test-results/**",
      "e2e/.auth/**",
      ".wrangler/**",
      "public/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
    ],
  },

  // --- S19 (lint-setup) baseline triage ------------------------------------
  // Orchestrator override for this slice: config-only, zero edits to source
  // files. Every rule disabled or scoped below produced real findings
  // against the pre-existing codebase; each is either a genuine architectural
  // finding whose fix is a source edit (out of scope here) or a false
  // positive against a test/mock/script idiom. Warn-level rules with
  // findings are left enabled — they don't fail `npm run lint` and stay
  // visible as a tightening backlog. Full inventory with counts and
  // representative files: docs/plans/devx-refactor/19-lint-setup.md.

  {
    rules: {
      // 295 findings (44 production files, 251 tests/mocks) across 60+
      // files — the largest single finding by far. Real typing debt (charter
      // wants adapter-boundary types, not `any`), but a repo-wide `any`
      // sweep is a dedicated slice, not a lint-config change.
      "@typescript-eslint/no-explicit-any": "off",
      // 20 findings, all `'` in JSX text (EntryForm.tsx, SearchForm.tsx,
      // EmailChangeModal.tsx, etc). Cosmetic; mechanical &apos;-escape fix
      // deferred to a source slice.
      "react/no-unescaped-entities": "off",
      // 17 findings. eslint-plugin-react-hooks v7's React Compiler
      // readiness rule: flags setState calls in effect bodies (useMediaQuery,
      // useCanEditCatalog, several flowsheet/login components). Legitimate
      // charter §7.4 audit targets, but re-deriving each one is a behavioral
      // change, not a lint-config change.
      "react-hooks/set-state-in-effect": "off",
      // 15 findings. Same React Compiler rule family: flags reading/writing
      // `ref.current` during render (StoreProvider, ThemePicker,
      // playlistSearchHooks debounce-guard refs). Needs per-case review.
      "react-hooks/refs": "off",
      // 4 findings, `let` that's never reassigned (adminHooks.ts, djHooks.ts,
      // RequiredBox.tsx). Mechanical but still a source edit.
      "prefer-const": "off",
      // 3 findings in catalogHooks/flowsheetHooks/playlistSearchHooks: the
      // React Compiler memoization-shape rule. Needs the hook bodies
      // reviewed against charter §7.5-7.7, not a blanket rewrite.
      "react-hooks/preserve-manual-memoization": "off",
      // 2 findings: Quotes/Forgot.tsx, Quotes/HoldOn.tsx call something
      // non-deterministic during render per the React Compiler purity rule.
      // Warn (not off) so new violations stay visible without failing CI.
      "react-hooks/purity": "warn",
      // 2 findings in binHooks.ts (`info?.id!`). Pre-existing non-null
      // assertion on an optional chain; correctness needs a look, not a
      // mechanical rename. Warn (not off) — real undefined-access footgun.
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
    },
  },
  {
    files: TEST_FILES,
    rules: {
      // 7 findings: test harnesses and mocks pass `children` through
      // `createElement(Component, { ...props, children })` instead of as a
      // positional arg (component-harness.ts and several *.test.tsx files).
      "react/no-children-prop": "off",
      // 5 findings: Playwright's `test.extend({..., use})` fixture pattern
      // (e2e/fixtures/auth.fixture.ts) and an inline `vi.mock` factory
      // component (queue/page.test.tsx) both read as hook-rule violations
      // to the heuristic that spots hooks by name — neither is a component
      // or a hook. False positive against test-only idioms.
      "react-hooks/rules-of-hooks": "off",
      // 4 findings: `const module = await import(...)` in theme.test.ts
      // shadows the name the rule reserves for CommonJS's global, but
      // there's no CJS `module` in these ESM test files to collide with.
      "@next/next/no-assign-module-variable": "off",
      // 3 findings: `vi.mock` factories typed with the broad `Function`
      // type as a quick stub signature (switch.test.ts, rightbar.test.ts,
      // session.test.ts).
      "@typescript-eslint/no-unsafe-function-type": "off",
      // 1 finding: an inline anonymous mock component in
      // useCatalogQueryResults.test.tsx never needs a displayName to debug.
      "react/display-name": "off",
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: {
      // 2 findings in scripts/post-build.js: a plain Node CJS script run
      // outside the Next.js/TypeScript module graph, where `require()` is
      // the normal idiom.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // The `node` project's tiers only (DOM_FREE_TIERS in
    // tests/setup/vitest-projects.ts, widened from "test files only" to
    // "any ts/tsx file" by widenTierGlobToAnyTsFile so the two can't drift):
    // the `@/tests/helpers` barrel re-exports render.tsx, field-value.ts, and
    // component-harness.ts -- all three import @testing-library/react -- so
    // any import from the barrel (not just a fixture/constant name) pulls RTL
    // into the node project. Ban the barrel outright, in both its aliased and
    // relative specifier forms, and point at the deep paths that are already
    // RTL-free. `ignores` carves out the DOM_DEPENDENT_LIB_TESTS pins: they
    // sit under tests/unit/lib/** but run in jsdom-lib, not node, so the
    // barrel ban's justification doesn't hold for them.
    files: DOM_FREE_TIERS.map(widenTierGlobToAnyTsFile),
    ignores: DOM_DEPENDENT_LIB_TESTS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // `regex` (unlike `group`, which treats a bare name as a
              // gitignore-style prefix) matches only the barrel itself, not
              // the permitted @/tests/helpers/constants deep import. The
              // optional "/index" suffix matches an explicit index specifier,
              // which resolves to the identical module but wouldn't
              // otherwise match this anchored pattern.
              regex: "^@/tests/helpers(/index)?$",
              message: BARREL_BAN_MESSAGE,
            },
            {
              // A relative specifier for the same barrel module ("../helpers"
              // from tests/contract, "../../helpers" from tests/unit/lib,
              // one more "../" per extra level of nesting, either with or
              // without an explicit "/index") resolves identically but
              // doesn't match the alias regex above -- it evades the rule and
              // reintroduces RTL into the node project exactly as the aliased
              // form would. Anchored at both ends so it doesn't also catch a
              // legitimate deeper import such as "../../helpers/store".
              regex: "^(\\.\\./)+helpers(/index)?$",
              message: BARREL_BAN_MESSAGE,
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
