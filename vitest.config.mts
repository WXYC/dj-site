import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import {
  DOM_DEPENDENT_LIB_TESTS,
  DOM_FREE_TIERS,
} from "./tests/setup/vitest-projects";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    exclude: ["node_modules", ".claude/**"],
    globals: true,
    // Vitest's 5s default sits below what this suite's slowest legitimately-
    // passing specs need once the machine is busy — a catalog slice test takes
    // ~6.5s of real work on an idle box, and component specs that type through
    // a form are far slower under CPU contention than in isolation. Raising the
    // ceiling costs nothing when a test passes: it moves the point at which a
    // loaded machine turns a correct test red, not the time any test takes.
    // Must move together with RTL's `asyncUtilTimeout` in tests/setup — see the
    // note there for why raising one alone leaves the suite flaky.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*", "src/**/*"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
      ],
    },
    // tests/unit/lib and tests/contract never touch the DOM, so they don't
    // need jsdom's per-file construction cost. `--changed`/`--shard` (used by
    // CI) walk this same projects list, not the legacy single-environment
    // config, so the split has to live here rather than per-file
    // `@vitest-environment` docblocks. Every include/exclude below is a
    // static pattern, never a resolved file list: watch mode routes a newly
    // created file by matching it against each project's patterns, so a list
    // materialised at config load would assign new specs by when vitest
    // started rather than by where the file lives. And because an exclude
    // beats an include naming the same file (there's no re-inclusion), the
    // pinned specs can't be carved back into the main jsdom project — they
    // need a project of their own.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: DOM_FREE_TIERS,
          exclude: DOM_DEPENDENT_LIB_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          // A project's own setupFiles is concatenated onto the root's under
          // extends: true, not swapped in -- restating vitest.setup.ts here
          // would run its MSW server.listen() twice per file and throw.
          setupFiles: ["./tests/setup/vitest.setup.dom.ts"],
          include: ["**/*.test.{ts,tsx}"],
          exclude: DOM_FREE_TIERS,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom-lib",
          environment: "jsdom",
          setupFiles: ["./tests/setup/vitest.setup.dom.ts"],
          include: DOM_DEPENDENT_LIB_TESTS,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
