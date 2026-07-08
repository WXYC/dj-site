import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

/**
 * Keyboard-only entry path through the flowsheet search bar.
 *
 * The v1 version of this spec imported `test` from `@playwright/test` directly
 * and never set a `storageState`, so it redirected to /login and timed out on
 * the search inputs — it never actually exercised the keyboard path in CI.
 * This uses the shared auth fixture + musicDirector session and goes live so
 * the inputs are enabled.
 *
 * Drives the v2 smart-entry composer (a single continuous input): type the
 * whole sentence, then Enter to commit.
 */
const authDir = path.join(__dirname, "../../.auth");

test.describe("flowsheet keyboard entry", () => {
  test.use({ storageState: path.join(authDir, "musicDirector.json") });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let flowsheet: FlowsheetPage;

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
    await flowsheet.ensureLive();
  });

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

  test("renders exactly one composer (no duplicate-testid regression)", async ({
    page,
  }) => {
    // v1's mobile modal rendered a second copy of the entry inputs, producing
    // duplicate testids that broke strict locators. v2 is a single responsive
    // component — assert the key nodes are unique.
    for (const id of ["flowsheet-smart-entry", "flowsheet-composer"]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(1);
    }
  });

  test("keyboard-only entry path", async ({ page }) => {
    // The v2 composer is one continuous input — type the whole sentence, then
    // Enter to commit (no Tab between fields).
    await flowsheet.composer.click();
    await flowsheet.composer.pressSequentially("Percolator by Stereolab", {
      delay: 20,
    });

    // Enter commits → play. Wait for the POST and the composer clearing.
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 30000 }
    );
    await flowsheet.composer.press("Enter");
    await responsePromise;
    await expect(flowsheet.composer).toHaveValue("", { timeout: 2000 });
  });
});
