// Shared between vitest.config.mts and tests/unit/vitest.config.test.ts —
// the config cannot be imported from a test (TS forbids importing an .mts
// path without allowImportingTsExtensions), so the project-partition inputs
// live here where both sides can reach them.
//
// eslint.config.mjs also imports this module directly, which runs it through
// Node's own ESM loader (native type-stripping) rather than Vite's/Vitest's
// resolver. Keep this file erasable-only TypeScript — no enums, no
// namespaces, no constructor parameter properties, no `import x = require()`
// — and never reach for the `@/` path alias, since Node's loader doesn't
// resolve it and only Vite's does.

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
// older "DOM-free" name, but it means exactly "the node project's tiers" --
// this is the only place the glob patterns themselves are written out;
// docs/testing.md describes the same two directories in prose (see
// Environments), and eslint.config.mjs derives its barrel-ban override's
// `files` from this constant via widenTierGlobToAnyTsFile below rather than
// restating them.
export const DOM_FREE_TIERS = [
  "tests/unit/lib/**/*.test.{ts,tsx}",
  "tests/contract/**/*.test.{ts,tsx}",
];

const GLOB_MIDDLE = "/**/";

// Every DOM_FREE_TIERS entry (and the barrel-ban override's widened form of
// it) has the shape "<dir>/**/<tail>". Splitting on the literal "/**/"
// separator -- rather than truncating at the first "/**" and discarding the
// rest -- is what lets callers compare or transform the tail instead of
// silently ignoring it.
export function splitTierGlob(pattern: string): { dir: string; tail: string } {
  const index = pattern.indexOf(GLOB_MIDDLE);
  if (index === -1) {
    throw new Error(
      `Tier glob "${pattern}" is missing the "${GLOB_MIDDLE}" separator every helper in this file assumes.`,
    );
  }
  return {
    dir: pattern.slice(0, index),
    tail: pattern.slice(index + GLOB_MIDDLE.length),
  };
}

const NODE_TEST_FILE_TAIL = "*.test.{ts,tsx}";
const NODE_ANY_FILE_TAIL = "*.{ts,tsx}";

// The barrel-ban lint override (eslint.config.mjs) bans the barrel for every
// ts/tsx file in a node tier, not just its test files -- the barrel's
// render/store graph costs the same regardless of whether the importing file
// is itself a test. This widens a DOM_FREE_TIERS entry from "test files only"
// to "any ts/tsx file", and throws instead of silently no-op'ing when a
// pattern's tail isn't the expected `*.test.{ts,tsx}` -- a literal-string
// replace that only matches that exact tail would otherwise leave a
// differently-spelled tier's override scope narrower than intended with no
// signal anywhere.
export function widenTierGlobToAnyTsFile(pattern: string): string {
  const { dir, tail } = splitTierGlob(pattern);
  if (tail !== NODE_TEST_FILE_TAIL) {
    throw new Error(
      `Tier glob "${pattern}" doesn't end with "${NODE_TEST_FILE_TAIL}" -- update widenTierGlobToAnyTsFile in tests/setup/vitest-projects.ts to match its new tail before the barrel-ban override silently narrows.`,
    );
  }
  return `${dir}${GLOB_MIDDLE}${NODE_ANY_FILE_TAIL}`;
}
