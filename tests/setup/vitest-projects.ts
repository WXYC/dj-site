// Shared between vitest.config.mts and tests/unit/vitest.config.test.ts —
// the config cannot be imported from a test (TS forbids importing an .mts
// path without allowImportingTsExtensions), so the project-partition inputs
// live here where both sides can reach them.

// These tests/unit/lib specs reach a real `window` (localStorage assigned via
// Object.defineProperty, or a spy on the `window` global itself) rather than
// going through a globalThis stub, so they stay on a jsdom project even
// though nothing in them renders. The config test asserts every entry still
// names a file on disk — a renamed spec would otherwise fall through to the
// node project and fail there.
export const DOM_DEPENDENT_LIB_TESTS = [
  "tests/unit/lib/features/application/login-method-storage.test.ts",
  "tests/unit/lib/features/experiences/local-storage.test.ts",
  "tests/unit/lib/features/flowsheet/queue-storage.test.ts",
  "tests/unit/lib/store.test.tsx",
  "tests/unit/lib/posthog.test.ts",
  "tests/unit/lib/sentry.test.ts",
  "tests/unit/lib/web-vitals-reporter.test.ts",
];

// The include patterns for the `node` project (docs/testing.md and
// eslint.config.mjs both name it that way now). The identifier keeps the
// older "DOM-free" name, but it means exactly "the node project's tiers" —
// this is the one place left that still spells it out.
export const DOM_FREE_TIERS = [
  "tests/unit/lib/**/*.test.{ts,tsx}",
  "tests/contract/**/*.test.{ts,tsx}",
];
