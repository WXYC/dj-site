import path from "path";
import {
  createTestAlbumSearchResult,
  wxycCanonicalArtistNames,
} from "@wxyc/shared/test-utils";
import { test, expect } from "../../fixtures/auth.fixture";
import { stubCatalogSearch } from "../../helpers/catalog-route";

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
 * The search is stubbed because the seeded CI database is far too small for any
 * query to overflow the viewport, which is the precondition the whole test rests
 * on. A classic identity is required too: for a signed-in context the account's
 * appSkin decides the experience, so the app_state cookie cannot reach classic.
 */
test.describe("Classic catalog overflow", () => {
  test.use({ storageState: path.join(authDir, "classicDj.json") });

  test("scrolls to the last result on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });

    // Enough rows to overflow a 500px viewport several times over. Distinct
    // ids because the results table keys rows by id.
    const mockRows = wxycCanonicalArtistNames.slice(0, 40).map((artist_name, i) =>
      createTestAlbumSearchResult({
        id: 9000 + i,
        album_title: `Live at WXYC, Vol. ${i + 1}`,
        artist_name,
      })
    );

    await stubCatalogSearch(page, mockRows);

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
