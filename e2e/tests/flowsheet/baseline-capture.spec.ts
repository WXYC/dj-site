import { test } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

/**
 * Captures a real screenshot baseline of the flowsheet entry bar so the v2
 * smart-entry redesign has a concrete "before" reference to compare against.
 *
 * The v1 version of this spec imported `test` from `@playwright/test` directly
 * and never set a `storageState`, so every navigation redirected to /login and
 * the capture silently never happened. This uses the shared auth fixture +
 * musicDirector session (kept off dj/dj2, owned by the auth/entry-caching
 * specs) and goes live so the bar renders in its normal interactive state.
 *
 * The search form is live-only, so this mirrors the crash-smoke spec: serial
 * mode, ensure-live per test, ensure off-air in afterAll.
 */
const authDir = path.join(__dirname, "../../.auth");

const BASELINE_DIR = path.join(
  __dirname,
  "../../../docs/plans/flowsheet-entry-redesign/baseline"
);

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "900", width: 900, height: 800 },
  { name: "600", width: 600, height: 800 },
  { name: "375", width: 375, height: 800 },
];

test.describe("flowsheet entry bar baseline", () => {
  test.use({ storageState: path.join(authDir, "musicDirector.json") });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "musicDirector.json"),
      baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    });
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureOffAir();
    await context.close();
  });

  for (const vp of VIEWPORTS) {
    test.describe(`@ ${vp.name}px`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`idle light`, async ({ page }) => {
        const flowsheet = new FlowsheetPage(page);
        await flowsheet.goto();
        await flowsheet.waitForEntriesLoaded();
        await flowsheet.ensureLive();
        await flowsheet.searchForm.waitFor({ state: "visible" });
        await page.screenshot({
          path: path.join(BASELINE_DIR, `${vp.name}-idle-light.png`),
          fullPage: false,
        });
      });
    });
  }
});
