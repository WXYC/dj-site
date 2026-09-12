import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import { DOM_DEPENDENT_LIB_TESTS } from "@/tests/setup/vitest-projects";

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

const NODE_TIER_DIRS = ["tests/unit/lib", "tests/contract"];
const PINNED = new Set(DOM_DEPENDENT_LIB_TESTS);

// render.tsx, field-value.ts, and component-harness.ts are the barrel's only
// re-exports that import @testing-library/react. The no-restricted-imports
// rule (eslint.config.mjs) bans the barrel itself -- the only re-export path
// to those three from the node tier -- but doesn't forbid a spec from
// deep-importing one of them directly, or importing @testing-library/react
// itself; nothing about the lint rule's shape prevents either. This asserts
// the stronger invariant docs/testing.md states, independent of whether the
// lint rule's coverage ever drifts.
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

const RTL_HELPER_NAMES = ["render", "field-value", "component-harness"];

function reachesRtlDirectly(specifier: string): boolean {
  if (specifier.startsWith("@testing-library/")) return true;
  return RTL_HELPER_NAMES.some(
    (name) =>
      specifier === `@/tests/helpers/${name}` ||
      new RegExp(`^(\\.\\./)+helpers/${name}$`).test(specifier),
  );
}

const IMPORT_SPECIFIER_RE =
  /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\))/g;

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER_RE)].map(
    (match) => match[1] ?? match[2],
  );
}

describe("node project stays free of @testing-library/react", () => {
  it.each(nodeTierFiles)("%s does not reach RTL directly", (relPath) => {
    const source = readFileSync(resolve(ROOT, relPath), "utf8");
    const offending = importSpecifiers(source).filter(reachesRtlDirectly);
    expect(offending).toEqual([]);
  });
});
