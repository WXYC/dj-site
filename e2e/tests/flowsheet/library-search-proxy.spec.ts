import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Library Search Proxy E2E Tests
 *
 * Verifies that dj-site routes library catalog searches through
 * Backend-Service's GET /proxy/library/search instead of calling
 * LML directly. Uses route interception to verify the request
 * shape and auth headers without requiring LML to be running.
 *
 * The search form is only visible when the DJ is live, so these
 * tests use serial mode and go live in the first test.
 */
test.describe("Library Search Proxy", () => {
  // Use musicDirector to avoid live-state conflicts with entry-caching tests
  // (which toggle dj2 live/off-air) and session conflicts with auth tests
  // (which invalidate dj.json).
  test.use({ storageState: path.join(authDir, "musicDirector.json") });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let flowsheet: FlowsheetPage;
  let isLive = false;

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
    if (!isLive) {
      await flowsheet.goLive();
      isLive = true;
    }
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

  test("search calls Backend-Service proxy with auth header", async ({
    page,
  }) => {
    // Set up route interception BEFORE typing
    const proxyRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/proxy/library/search"),
      { timeout: 5000 },
    );

    await page.route("**/proxy/library/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: 42,
              title: "Aluminum Tunes",
              artist: "Stereolab",
              call_letters: "RO",
              artist_call_number: 87,
              release_call_number: 1,
              genre: "Rock",
              format: "CD",
              alternate_artist_name: null,
              label: "Duophonic",
              on_streaming: true,
              call_number: "Rock CD RO 87/1",
              library_url:
                "http://www.wxyc.info/wxycdb/libraryRelease?id=42",
            },
          ],
          total: 1,
          query: "Stereolab",
        }),
      });
    });

    // Type enough to trigger the debounced search (min 3 chars combined)
    await flowsheet.artistInput.fill("Stereolab");
    await flowsheet.albumInput.fill("Aluminum");

    // Wait for the proxy request to fire
    const request = await proxyRequestPromise;
    const url = request.url();
    const authHeader = request.headers()["authorization"];

    expect(url).toContain("/proxy/library/search");
    expect(url).toContain("artist=Stereolab");
    expect(url).toContain("title=Aluminum");
    expect(authHeader).toMatch(/^Bearer .+/);
  });

  test("search does not call LML directly", async ({ page }) => {
    let lmlDirectCalled = false;

    // Watch for any direct LML calls (port 8000 = LML default)
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes(":8000/") &&
        url.includes("/api/v1/library/search")
      ) {
        lmlDirectCalled = true;
      }
    });

    // Intercept proxy calls so they succeed
    await page.route("**/proxy/library/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], total: 0, query: null }),
      }),
    );

    await flowsheet.artistInput.fill("Cat Power");
    await flowsheet.albumInput.fill("Moon Pix");

    // Wait past debounce (350ms) + network roundtrip margin
    await page.waitForTimeout(600);

    expect(lmlDirectCalled).toBe(false);
  });
});
