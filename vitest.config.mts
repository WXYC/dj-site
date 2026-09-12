import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { globSync } from "fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

// These tests/unit/lib specs reach a real `window` (localStorage assigned via
// Object.defineProperty, or a spy on the `window` global itself) rather than
// going through a globalThis stub, so they stay on the jsdom project even
// though nothing in them renders.
const DOM_DEPENDENT_LIB_TESTS = new Set([
  "tests/unit/lib/features/application/login-method-storage.test.ts",
  "tests/unit/lib/features/experiences/local-storage.test.ts",
  "tests/unit/lib/features/flowsheet/queue-storage.test.ts",
  "tests/unit/lib/features/flowsheet/live-updates-listener.test.ts",
  "tests/unit/lib/store.test.tsx",
  "tests/unit/lib/posthog.test.ts",
  "tests/unit/lib/sentry.test.ts",
  "tests/unit/lib/web-vitals-reporter.test.ts",
]);

// Vitest's exclude list wins over any include entry that names the same file
// (there's no re-inclusion), so the jsdom project can't blanket-exclude these
// two directories and then list the 8 exceptions back in its own include --
// it has to exclude precisely the files the node project claims. Resolving
// the glob here, once, keeps both projects' file sets an exact complement of
// each other instead of two hand-maintained lists that can drift apart.
const NODE_PROJECT_FILES = globSync(
  ["tests/unit/lib/**/*.test.{ts,tsx}", "tests/contract/**/*.test.{ts,tsx}"],
  { cwd: __dirname }
).filter((file) => !DOM_DEPENDENT_LIB_TESTS.has(file));

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
    // `@vitest-environment` docblocks.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: NODE_PROJECT_FILES,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["node_modules", ".claude/**", ...NODE_PROJECT_FILES],
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
