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
 */
test.describe("Library Search Proxy", () => {
  test.use({ storageState: path.join(authDir, "dj.json") });

  let flowsheet: FlowsheetPage;

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
  });

  test("search calls Backend-Service proxy with auth header", async ({
    page,
  }) => {
    let capturedUrl: string | undefined;
    let capturedAuthHeader: string | null | undefined;

    // Intercept the proxy request and return a mock response
    await page.route("**/proxy/library/search**", async (route) => {
      const request = route.request();
      capturedUrl = request.url();
      capturedAuthHeader = request.headers()["authorization"];

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

    // Type enough to trigger the debounced search
    await flowsheet.artistInput.click();
    await flowsheet.artistInput.fill("Stereolab");
    await flowsheet.albumInput.fill("Aluminum");

    // Wait for the intercepted request
    await page.waitForTimeout(500); // debounce is 350ms

    expect(capturedUrl).toBeDefined();
    expect(capturedUrl).toContain("/proxy/library/search");
    expect(capturedUrl).toContain("artist=Stereolab");
    expect(capturedUrl).toContain("title=Aluminum");
    expect(capturedAuthHeader).toMatch(/^Bearer .+/);
  });

  test("search does not call LML directly", async ({ page }) => {
    let lmlDirectCalled = false;

    // Watch for any direct LML calls
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes(":8000/") &&
        url.includes("/api/v1/library/search")
      ) {
        lmlDirectCalled = true;
      }
    });

    // Intercept proxy calls so they don't fail
    await page.route("**/proxy/library/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], total: 0, query: null }),
      })
    );

    await flowsheet.artistInput.click();
    await flowsheet.artistInput.fill("Cat Power");
    await flowsheet.albumInput.fill("Moon Pix");

    await page.waitForTimeout(500);

    expect(lmlDirectCalled).toBe(false);
  });
});
