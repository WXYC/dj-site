import { test, expect } from "../../fixtures/auth.fixture";
import { AlbumDetailPage } from "../../pages/album-detail.page";
import { DashboardPage } from "../../pages/dashboard.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Mock catalog API response for a known album.
 * Uses WXYC-representative data (Juana Molina - DOGA).
 */
const MOCK_ALBUM_ID = 9999;
const MOCK_ALBUM_RESPONSE = {
  id: MOCK_ALBUM_ID,
  album_title: "DOGA",
  artist_name: "Juana Molina",
  code_artist_number: 42,
  code_letters: "RO",
  code_number: 1,
  format_name: "CD",
  genre_name: "Rock",
  label: "Sonamos",
  plays: 17,
  add_date: "2023-08-15",
};

const MOCK_CATALOG_RESULTS = [MOCK_ALBUM_RESPONSE];

const MOCK_METADATA_RESPONSE = {
  artworkUrl: "https://example.com/doga-cover.jpg",
  label: "Sonamos",
  releaseYear: 2004,
  genres: ["Rock", "Latin"],
  styles: ["Art Rock", "Experimental"],
  discogsUrl: "https://www.discogs.com/release/12345",
  spotifyUrl: "https://open.spotify.com/album/test",
  tracklist: [
    { position: "1", title: "la paradoja", duration: "4:23" },
    { position: "2", title: "el desconfiado", duration: "3:45" },
    { position: "3", title: "vaca", duration: "5:12" },
  ],
};

/**
 * Set up route interception for catalog and metadata APIs.
 * Ensures tests are deterministic regardless of backend seed data.
 */
async function interceptAlbumApis(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/library/info**", async (route) => {
    const url = new URL(route.request().url());
    const albumId = url.searchParams.get("album_id");

    if (albumId === String(MOCK_ALBUM_ID)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ALBUM_RESPONSE),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
    }
  });

  await page.route("**/proxy/metadata/album**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_METADATA_RESPONSE),
    });
  });

  await page.route("**/proxy/metadata/artist**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bio: "Juana Molina is an Argentine singer, songwriter, and actress.",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Juana_Molina",
      }),
    });
  });

  await page.route("**/library/query**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: MOCK_CATALOG_RESULTS,
        total: MOCK_CATALOG_RESULTS.length,
        page: 0,
        totalPages: 1,
      }),
    });
  });
}

/** Open the album card from catalog search via the row's info icon. */
async function openAlbumViaCatalog(
  page: import("@playwright/test").Page,
  dashboard: DashboardPage,
  albumDetail: AlbumDetailPage,
): Promise<void> {
  await dashboard.gotoCatalog();
  await dashboard.waitForPageLoad();

  const searchInput = page.getByPlaceholder("Search the catalog").first();
  await searchInput.fill("Juana Molina");
  await expect(page.getByText("DOGA")).toBeVisible({ timeout: 10000 });

  // The desktop row actions are hover-revealed, so hover the row before
  // clicking its "More information" icon. Scope to the desktop table row
  // (the mobile card list is not a <tr>).
  const resultRow = page
    .locator("#OrderTableContainer tbody tr")
    .filter({ hasText: "DOGA" })
    .first();
  await resultRow.hover();
  await resultRow.locator('button[aria-label="More information"]').click();

  await albumDetail.waitForModal();
  await albumDetail.waitForAlbumLoaded("DOGA");
}

test.describe("Album Detail Card", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });

  let albumDetail: AlbumDetailPage;
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    albumDetail = new AlbumDetailPage(page);
    dashboard = new DashboardPage(page);
  });

  test.describe("Modal presentation", () => {
    test("opens as a modal with a page-scoped permalink", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);

      await albumDetail.expectModalVisible();
      await albumDetail.expectModalText("Juana Molina");
      await expect(page).toHaveURL(new RegExp(`/dashboard/catalog/album/${MOCK_ALBUM_ID}$`));
    });

    test("shows tracklist, streaming links, and footer metadata", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);

      await albumDetail.expectModalText("la paradoja");
      await albumDetail.expectModalText("el desconfiado");
      await expect(
        albumDetail.modal.locator('a[class*="MuiChip"]').filter({ hasText: "Spotify" }),
      ).toBeVisible({ timeout: 10000 });
      await albumDetail.expectModalText("17 plays");
      await expect(albumDetail.modal.locator('a:has-text("Discogs")')).toHaveAttribute(
        "href",
        MOCK_METADATA_RESPONSE.discogsUrl,
      );
    });

    test("close restores the catalog URL and page", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);

      await albumDetail.close();

      await expect(page).toHaveURL(/\/dashboard\/catalog$/);
      await dashboard.expectOnCatalog();
    });

    test("a pasted permalink renders the card over the catalog", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto("/dashboard/catalog", MOCK_ALBUM_ID);

      await albumDetail.waitForModal();
      await albumDetail.expectModalText("DOGA");
      await expect(page.getByPlaceholder("Search the catalog").first()).toBeVisible();
    });
  });

  test.describe("Pinning and the rail", () => {
    test("pinning docks the card beside the rail and keeps the page interactive", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);

      await albumDetail.pin();

      await albumDetail.expectModalHidden();
      await albumDetail.expectDockedCardVisible();
      await albumDetail.expectDockedText("DOGA");
      await albumDetail.expectRailVisible();
      await expect(page.getByPlaceholder("Search the catalog").first()).toBeVisible();
    });

    test("collapse hides the pane; the rail tile reopens it", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);
      await albumDetail.pin();

      await albumDetail.dockedCollapseButton.click();
      await expect(albumDetail.dockedUnpinButton).toBeHidden();
      await albumDetail.expectRailVisible();

      await albumDetail.railAlbumTiles.first().click();
      await albumDetail.expectDockedCardVisible();
    });

    test("the home tile swaps the pane to NowPlaying + Bin without hiding the rail", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);
      await albumDetail.pin();

      await albumDetail.railHomeExpandButton.click();
      await expect(albumDetail.dockedPanel.getByText("Now Playing").first()).toBeVisible();
      await expect(albumDetail.dockedUnpinButton).toBeHidden();
      await albumDetail.expectRailVisible();

      await albumDetail.railHomeCollapseButton.click();
      await expect(albumDetail.dockedPanel.getByText("Now Playing").first()).toBeHidden();
      await albumDetail.expectRailVisible();
    });

    test("navigating pages carries the open album in the URL", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);
      await albumDetail.pin();

      await page.locator(`a[href="/dashboard/flowsheet/album/${MOCK_ALBUM_ID}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/flowsheet/album/${MOCK_ALBUM_ID}$`));
      await albumDetail.expectDockedCardVisible();
    });

    test("unpinning from the rail restores the full rightbar without a modal", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);
      await albumDetail.pin();

      await albumDetail.railAlbumTiles.first().hover();
      await albumDetail.railUnpinBadges.first().click();

      await albumDetail.expectModalHidden();
      await albumDetail.expectFullRightbar();
      await expect(page).toHaveURL(/\/dashboard\/catalog$/);
    });

    test("unpinning from the docked header hands the card back to the modal", async ({ page }) => {
      await interceptAlbumApis(page);
      await openAlbumViaCatalog(page, dashboard, albumDetail);
      await albumDetail.pin();

      await albumDetail.dockedUnpinButton.click();

      await albumDetail.expectModalVisible();
      await albumDetail.expectModalText("DOGA");
      await albumDetail.expectFullRightbar();
    });
  });
});
