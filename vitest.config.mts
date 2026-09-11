import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
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
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
