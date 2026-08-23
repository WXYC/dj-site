import path from "path";
import { wxycCanonicalArtistNames } from "@wxyc/shared/test-utils";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Drives the mouse wheel rather than scrollIntoView: an `overflow: hidden` box
 * still has a scrollport, so programmatic scrolling succeeds on a page the user
 * has no way to scroll. Only a real scroll container answers the wheel.
 *
 * The shell clips its own overflow so the dashboard can own internal scroll
 * regions. Modern carries those inside its panels; classic is plain HTML and
 * has none, so a result list longer than the viewport is unreachable unless the
 * classic container is itself a scrollport.
 *
 * The catalog search is stubbed rather than run against the seeded CI
 * database: the CI seed is 9 artists / 10 library rows, and no query against
 * it returns enough rows to overflow a 500px viewport. The mock returns rows
 * in the raw AlbumSearchResultJSON shape `convertToAlbumEntry` consumes (same
 * predicate as flowsheet/backend-results-cap.spec.ts and
 * flowsheet/flowsheet-track-picker.spec.ts).
 */
test.describe("Classic catalog overflow", () => {
  test.use({ storageState: path.join(authDir, "classicDj.json") });

  // The legacy catalog endpoint the classic search results table hits
  // (`useSearchCatalogQuery` -> GET `<base>/library/?...`). NOT the
  // `/proxy/library/*` LML proxy.
  const isCatalogSearch = (url: URL) =>
    url.pathname.endsWith("/library/") && !url.pathname.includes("/proxy/");

  test("scrolls to the last result on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });

    // 40 rows, comfortably past the 500px viewport and under the search
    // results table's n: 50 cap, drawn from the WXYC canonical artist pool
    // rather than synthetic "Artist N" names. Each row is a stand-in WXYC
    // session recording, tying the rows together under one shared label so
    // the "wxyc" query below reads as a real search against them.
    const mockRows = wxycCanonicalArtistNames.slice(0, 40).map((artist_name, i) => ({
      id: 9000 + i,
      album_title: `Live at WXYC, Vol. ${i + 1}`,
      artist_name,
      code_letters: "WX",
      code_artist_number: i + 1,
      code_number: 1,
      genre_name: "Freeform",
      format_name: "LP",
      label: "WXYC Session Archive",
      add_date: "2024-01-01",
    }));

    await page.route(isCatalogSearch, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRows),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto("/dashboard/catalog?searchString=wxyc");

    const rows = page.locator("#liveResults table.entry-table tbody tr");
    await expect(rows.first()).toBeVisible();
    const lastRow = rows.last();
    await expect(lastRow).not.toBeInViewport();

    await page.mouse.move(512, 250);
    await page.mouse.wheel(0, 4000);

    await expect(lastRow).toBeInViewport();
  });
});
