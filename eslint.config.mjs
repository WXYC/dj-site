import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
];

export default eslintConfig;
