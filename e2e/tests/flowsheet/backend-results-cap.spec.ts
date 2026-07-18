import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Regression test for dj-site#657 — FlowsheetBackendResults must not render an
 * unbounded backend response.
 *
 * A misbehaving backend (the uncapped "Various Artists" case, BS#1162) can
 * return thousands of rows. Rendering them all grew the DOM ~10K nodes/sec,
 * saturated the main thread, and froze the tab (never crashing outright, since
 * React's incremental scheduler keeps yielding). FlowsheetBackendResults now
 * hard-caps at 50 rendered rows with a truncation footer.
 *
 * This spec mocks the card-catalog search (`GET .../library/`, NOT the
 * `/proxy/library/*` LML proxy) to return 500 rows, mocks the LML proxy to
 * return nothing (so stray LML rows can't shift the counts), drives the real
 * flowsheet search path, and asserts:
 *   1. the catalog section renders a bounded row count (the cap engaged) and
 *      the truncation footer is shown — these are the regression gates;
 *   2. the main thread stays responsive across the window — a smoke check
 *      only: 500 rows renders fine even uncapped (the production freeze needed
 *      thousands), so responsiveness alone would not catch a dropped cap.
 *
 * Mirrors library-search-proxy.spec.ts / flowsheet-track-picker.spec.ts:
 * serial mode, musicDirector session (kept off dj/dj2), ensure-live per test,
 * ensure off-air in afterAll.
 *
 * CI-verified only: like every e2e spec it needs the Docker Backend-Service +
 * Playwright stack (`npm run test:e2e`), which isn't run here.
 */
test.describe("Flowsheet backend results — render cap", { tag: "@smoke" }, () => {
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

  // The legacy catalog endpoint the flowsheet's card-catalog search hits
  // (`useSearchCatalogQuery` → GET `<base>/library/?...`). NOT the
  // `/proxy/library/*` LML proxy — same predicate shape as the track-picker
  // spec's isCatalogSearch.
  const isCatalogSearch = (url: URL) =>
    url.pathname.endsWith("/library/") && !url.pathname.includes("/proxy/");

  test("a 500-row backend response neither freezes the tab nor renders unbounded rows", async ({
    page,
  }) => {
    // 500 rows in the raw AlbumSearchResultJSON shape convertToAlbumEntry
    // consumes. A distinctive, non-compilation artist name so the real
    // rotation/bin backends return nothing (the compilation guard would
    // otherwise skip the catalog search entirely).
    const ARTIST = "Zzz Cap Regression Artist";
    const rows = Array.from({ length: 500 }, (_, i) => ({
      id: 900000 + i,
      album_title: `Cap Album ${i}`,
      artist_name: ARTIST,
      code_letters: "ZZ",
      code_artist_number: 1,
      code_number: i,
      genre_name: "Rock",
      format_name: "cd",
      label: "Test Label",
      add_date: "2024-01-01",
      on_streaming: true,
    }));

    await page.route(isCatalogSearch, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(rows),
        });
      } else {
        await route.fallback();
      }
    });

    // Suppress LML proxy results (same pattern as flowsheet-track-picker's
    // catalog suppression, inverted) so stray library-search rows can't shift
    // the section counts asserted below. Rotation/bin filter client-side on
    // the distinctive artist and contribute nothing.
    await page.route("**/proxy/library/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], total: 0, query: ARTIST }),
      });
    });

    // Open the search and trigger the debounced catalog search.
    await expect(flowsheet.artistInput).toBeEnabled({ timeout: 10_000 });
    await flowsheet.songInput.click();
    await flowsheet.artistInput.fill(ARTIST);

    // The result list is populated once the mocked catalog response lands.
    const truncationFooter = page.locator(
      '[data-testid="flowsheet-results-truncated"]'
    );
    await expect(truncationFooter).toBeVisible({ timeout: 10_000 });

    // Primary regression gate: the CARD CATALOG section renders exactly the
    // cap, not the 500 the mock returned. Scoped to the section container so
    // rows from other sections can't inflate or mask the count.
    const catalogRows = page.locator(
      '[data-testid="flowsheet-results-section-from-the-card-catalog"] [data-testid^="flowsheet-search-result-"]'
    );
    await expect(catalogRows).toHaveCount(50);

    // Responsiveness smoke check (secondary): 500 rows renders fine even
    // uncapped — the production freeze needed thousands — so this loop can't
    // catch a dropped cap by itself; the footer + exact count above are the
    // real gates. It exists to flag a gross main-thread stall. The 1s ceiling
    // (vs the issue's ~100ms ideal) absorbs loaded CI runners.
    for (let i = 0; i < 30; i++) {
      const start = Date.now();
      await page.evaluate(() => 1);
      expect(Date.now() - start).toBeLessThan(1_000);
    }
  });
});
