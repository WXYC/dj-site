import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import {
  DOM_DEPENDENT_LIB_TESTS,
  DOM_FREE_TIERS,
} from "@/tests/setup/vitest-projects";

const ROOT = resolve(__dirname, "../..");
const rows = DOM_DEPENDENT_LIB_TESTS.map((entry) => [entry] as const);

// The node/jsdom project split carves these files out of the node project by
// literal path. Nothing else validates those strings: a pinned spec that is
// renamed or moved would silently fall through to the node project and fail
// there as "window is not defined" — or worse, pass vacuously. These
// assertions turn that drift into a config-test failure that names the file.
describe("DOM_DEPENDENT_LIB_TESTS", () => {
  it.each(rows)("%s exists on disk", (entry) => {
    expect(existsSync(resolve(ROOT, entry))).toBe(true);
  });

  it.each(rows)(
    "%s lives inside a tier the main jsdom project excludes",
    (entry) => {
      // A pin outside tests/unit/lib or tests/contract would be claimed by
      // BOTH the main jsdom project (its include matches every .test file)
      // and the jsdom-lib project, running the spec twice.
      expect(entry).toMatch(/^tests\/(unit\/lib|contract)\//);
    },
  );

  it.each(rows)(
    "%s matches the node project's include pattern it is excluded from",
    (entry) => {
      expect(entry).toMatch(/\.test\.(ts|tsx)$/);
    },
  );

  it("has no duplicate entries", () => {
    expect(new Set(DOM_DEPENDENT_LIB_TESTS).size).toBe(
      DOM_DEPENDENT_LIB_TESTS.length,
    );
  });
});

// Derived from DOM_FREE_TIERS (the actual node-project include patterns)
// rather than restated as literal directories, so a tier renamed or added
// there is picked up here automatically instead of silently falling out of
// this file's RTL check.
const NODE_TIER_DIRS = DOM_FREE_TIERS.map((pattern) => pattern.split("/**")[0]);
const PINNED = new Set(DOM_DEPENDENT_LIB_TESTS);

function collectTestFiles(relDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(resolve(ROOT, relDir))) {
    const relPath = `${relDir}/${entry}`;
    if (statSync(resolve(ROOT, relPath)).isDirectory()) {
      files.push(...collectTestFiles(relPath));
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(relPath);
    }
  }
  return files;
}

const nodeTierFiles = NODE_TIER_DIRS.flatMap(collectTestFiles).filter(
  (relPath) => !PINNED.has(relPath),
);

const HELPERS_DIR = "tests/helpers";

// Every module under tests/helpers/ that imports @testing-library/, found by
// reading each file rather than naming them by hand -- a hardcoded list
// can't backstop the drift it exists to catch, since a future helper that
// starts importing RTL just wouldn't be in it. render.tsx, field-value.ts,
// component-harness.ts, and classic-page-authority-harness.ts (used outside
// the barrel, but still a deep-import target from any tier) all currently
// qualify.
const RTL_HELPER_NAMES = readdirSync(resolve(ROOT, HELPERS_DIR))
  .filter((entry) => /\.(ts|tsx)$/.test(entry))
  .filter((entry) =>
    /@testing-library\//.test(
      readFileSync(resolve(ROOT, HELPERS_DIR, entry), "utf8"),
    ),
  )
  .map((entry) => entry.replace(/\.(ts|tsx)$/, ""));

// The no-restricted-imports rule (eslint.config.mjs) bans the barrel itself
// -- the only re-export path to the RTL-bearing helpers from the node tier
// -- but doesn't forbid a spec from deep-importing one of them directly, or
// importing @testing-library/react itself; nothing about the lint rule's
// shape prevents either. This asserts the stronger invariant docs/testing.md
// states, independent of whether the lint rule's coverage ever drifts.
function reachesRtlDirectly(rawSpecifier: string): boolean {
  const specifier = rawSpecifier.replace(/\.(ts|tsx)$/, "");
  if (specifier.startsWith("@testing-library/")) return true;
  return RTL_HELPER_NAMES.some(
    (name) =>
      specifier === `@/tests/helpers/${name}` ||
      new RegExp(`^(\\.\\./)+helpers/${name}$`).test(specifier),
  );
}

// Three forms: a named/default import ("from"), a dynamic import call, and a
// bare side-effect import (`import "@testing-library/jest-dom";`), which has
// no "from" clause and would otherwise slip past this scanner entirely.
const IMPORT_SPECIFIER_RE =
  /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["'])/g;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER_RE)].map(
    (match) => match[1] ?? match[2] ?? match[3],
  );
}

describe("node project stays free of @testing-library/react", () => {
  it.each(nodeTierFiles)("%s does not reach RTL directly", (relPath) => {
    const source = readFileSync(resolve(ROOT, relPath), "utf8");
    const offending = importSpecifiers(source).filter(reachesRtlDirectly);
    expect(offending).toEqual([]);
  });
});
