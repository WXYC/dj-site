import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
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
