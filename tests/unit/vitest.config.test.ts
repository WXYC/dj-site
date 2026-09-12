import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "path";
import {
  DOM_DEPENDENT_LIB_TESTS,
  DOM_FREE_TIERS,
  splitTierGlob,
  widenTierGlobToAnyTsFile,
} from "@/tests/setup/vitest-projects";
import eslintConfig from "../../eslint.config.mjs";

const ROOT = resolve(__dirname, "../..");
const tierDir = (pattern: string) => splitTierGlob(pattern).dir;
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
const NODE_TIER_DIRS = DOM_FREE_TIERS.map(tierDir);
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

// The lint override that bans the @/tests/helpers barrel derives its `files`
// from DOM_FREE_TIERS via widenTierGlobToAnyTsFile (eslint.config.mjs)
// rather than hand-copying the directories, so the assertions below exist
// to catch a future re-hardcoding or narrowing, not to compare two
// independently-edited lists. Found by its rule rather than by array
// position, so reordering eslint.config.mjs's other overrides doesn't break
// this lookup; `filter` plus a length assertion (rather than `find`) keeps
// the lookup total if a second `no-restricted-imports` override is ever
// added ahead of this one in the array.
const barrelBanOverrides = eslintConfig.filter(
  (entry) =>
    Array.isArray(entry.files) &&
    entry.rules?.["no-restricted-imports"] !== undefined,
);

describe("widenTierGlobToAnyTsFile", () => {
  it("widens a DOM_FREE_TIERS-shaped glob's test-file tail to any ts/tsx file", () => {
    expect(widenTierGlobToAnyTsFile("tests/unit/lib/**/*.test.{ts,tsx}")).toBe(
      "tests/unit/lib/**/*.{ts,tsx}",
    );
    expect(widenTierGlobToAnyTsFile("tests/contract/**/*.test.{ts,tsx}")).toBe(
      "tests/contract/**/*.{ts,tsx}",
    );
  });

  it("throws instead of silently narrowing when a glob's tail isn't the expected test-file pattern", () => {
    expect(() =>
      widenTierGlobToAnyTsFile("tests/contract/**/*.test.ts"),
    ).toThrow();
    expect(() =>
      widenTierGlobToAnyTsFile("tests/contract/**/*.spec.{ts,tsx}"),
    ).toThrow();
  });

  it("throws on a glob missing the /**/ separator", () => {
    expect(() =>
      widenTierGlobToAnyTsFile("tests/contract/*.test.{ts,tsx}"),
    ).toThrow();
  });
});

describe("eslint's barrel-ban override stays scoped to the node project", () => {
  it("exists exactly once", () => {
    expect(barrelBanOverrides).toHaveLength(1);
  });

  const barrelBanOverride = barrelBanOverrides[0];

  it("its files glob is exactly DOM_FREE_TIERS widened to any ts/tsx file", () => {
    // Comparing the full pattern (directory and tail together), not just
    // the directory prefix, is what catches a tail that's been narrowed or
    // hardcoded independently of DOM_FREE_TIERS -- a directory-only
    // comparison stays green for either.
    expect(barrelBanOverride!.files).toEqual(
      DOM_FREE_TIERS.map(widenTierGlobToAnyTsFile),
    );
  });

  it("its ignores carve out exactly the DOM_DEPENDENT_LIB_TESTS pins", () => {
    // Those seven specs sit under tests/unit/lib/** but run in jsdom-lib,
    // not node — the barrel ban's "RTL costs nothing in this tier"
    // justification is false for them, so the override must not claim them.
    expect(new Set(barrelBanOverride!.ignores)).toEqual(
      new Set(DOM_DEPENDENT_LIB_TESTS),
    );
  });
});

describe("tests/setup/vitest.setup.ts stays free of DOM testing-library imports", () => {
  it("does not import any @testing-library/* module, by source rather than runtime", () => {
    // Reuses importSpecifiers (defined above for the node-tier RTL check)
    // rather than a raw substring match, so a comment that merely mentions
    // "@testing-library/" -- e.g. documenting why the import lives
    // elsewhere -- doesn't fail this the way a plain toMatch would.
    const source = readFileSync(
      resolve(ROOT, "tests/setup/vitest.setup.ts"),
      "utf8",
    );
    const offending = importSpecifiers(source).filter((specifier) =>
      specifier.startsWith("@testing-library/"),
    );
    expect(offending).toEqual([]);
  });
});

describe("vitest projects don't double-wire the root setup file", () => {
  it("only the root setupFiles entry names vitest.setup.ts; project overrides use the dom variant", () => {
    // extends: true already concatenates the root's setupFiles onto every
    // project; a project restating vitest.setup.ts in its own setupFiles
    // would run MSW's server.listen() twice for that file and throw. Scoped
    // to each setupFiles array literal (rather than the whole file's text)
    // so a documentary comment mentioning the path doesn't trip this, and
    // matched on the bare filename (rather than a specific quote style or a
    // required "./" prefix) so `"vitest.setup.ts"` or
    // `resolve(__dirname, "tests/setup/vitest.setup.ts")` are caught the
    // same as the literal spelling used today.
    const source = readFileSync(resolve(ROOT, "vitest.config.mts"), "utf8");
    const setupFilesArrays = [
      ...source.matchAll(/setupFiles:\s*\[([^\]]*)\]/g),
    ].map((match) => match[1]);
    const arraysNamingRootSetup = setupFilesArrays.filter((arrayBody) =>
      /vitest\.setup\.ts/.test(arrayBody),
    );
    expect(arraysNamingRootSetup).toHaveLength(1);
  });
});
