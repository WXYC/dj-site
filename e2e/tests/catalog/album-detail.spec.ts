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
  // Intercept catalog info endpoint
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

  // Intercept metadata album endpoint
  await page.route("**/proxy/metadata/album**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_METADATA_RESPONSE),
    });
  });

  // Intercept metadata artist endpoint
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

  // Intercept catalog search endpoint to return mock results
  await page.route("**/library/?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_CATALOG_RESULTS),
    });
  });
}

test.describe("Album Detail Modal", () => {
  // Use dj2 to avoid session conflicts with auth tests that use dj.json
  test.use({ storageState: path.join(authDir, "dj2.json") });

  let albumDetail: AlbumDetailPage;
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    albumDetail = new AlbumDetailPage(page);
    dashboard = new DashboardPage(page);
  });

  test.describe("Direct URL Navigation", () => {
    test("should display album detail modal when navigating to album URL", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForModal();
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.expectModalVisible();
      await albumDetail.expectAlbumTitle("Juana Molina");
      await albumDetail.expectAlbumTitle("DOGA");
    });

    test("should display artwork", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.expectArtworkVisible();
    });

    test("should display play count", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.expectPlaysCount("17 plays");
    });

    test("should display tracklist", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      // Wait for metadata to load (tracklist comes from metadata API)
      await expect(page.locator("table")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("la paradoja")).toBeVisible();
      await expect(page.getByText("el desconfiado")).toBeVisible();
      await expect(page.getByText("vaca")).toBeVisible();
    });

    test("should display streaming links", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      // Streaming links from metadata (rendered as Chip components)
      await expect(albumDetail.streamingLinks.filter({ hasText: "Spotify" })).toBeVisible({ timeout: 10000 });
    });

    test("should display library status", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.expectLibraryStatusVisible();
    });

    test("should display Discogs link in footer", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      // Footer Discogs link
      const discogsLink = albumDetail.discogsLink;
      await expect(discogsLink).toBeVisible({ timeout: 10000 });
      await expect(discogsLink).toHaveAttribute("href", MOCK_METADATA_RESPONSE.discogsUrl);
    });

    test("should display added date", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.expectPlaysCount("17 plays");
      await expect(albumDetail.addedDate).toBeVisible();
    });
  });

  test.describe("Close Behavior", () => {
    test("should close modal when clicking close button", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(MOCK_ALBUM_ID);
      await albumDetail.waitForAlbumLoaded();

      await albumDetail.close();

      await albumDetail.expectModalHidden();
    });
  });

  test.describe("Error State", () => {
    test("should display error card for non-existent album", async ({ page }) => {
      await interceptAlbumApis(page);
      // Navigate to a non-existent album ID (interceptor returns 404)
      await albumDetail.goto(0);
      await albumDetail.waitForModal();

      await albumDetail.expectErrorState();
    });

    test("should display Go Back button in error state", async ({ page }) => {
      await interceptAlbumApis(page);
      await albumDetail.goto(0);
      await albumDetail.waitForModal();

      await albumDetail.expectErrorState();
      await expect(albumDetail.goBackButton).toBeVisible();
    });
  });

  test.describe("Catalog Integration", () => {
    test("should open album detail when clicking info icon on catalog result", async ({ page }) => {
      await interceptAlbumApis(page);
      await dashboard.gotoCatalog();
      await dashboard.waitForPageLoad();

      // Type a search term to trigger the catalog search
      const searchInput = page.getByRole("textbox", { name: "Search for an album or artist" });
      await searchInput.fill("Juana Molina");

      // Wait for results to load
      await expect(page.getByText("DOGA")).toBeVisible({ timeout: 10000 });

      // Click the info icon button on the result row
      const infoButton = page.locator('button[aria-label="More information"]').first();
      await infoButton.click();

      // Modal should open with album details
      await albumDetail.waitForModal();
      await albumDetail.waitForAlbumLoaded();
      await albumDetail.expectAlbumTitle("Juana Molina");
      await albumDetail.expectAlbumTitle("DOGA");
    });

    test("should return to catalog after closing album detail modal", async ({ page }) => {
      await interceptAlbumApis(page);
      await dashboard.gotoCatalog();
      await dashboard.waitForPageLoad();

      // Search and open album
      const searchInput = page.getByRole("textbox", { name: "Search for an album or artist" });
      await searchInput.fill("Juana Molina");
      await expect(page.getByText("DOGA")).toBeVisible({ timeout: 10000 });

      const infoButton = page.locator('button[aria-label="More information"]').first();
      await infoButton.click();

      await albumDetail.waitForModal();
      await albumDetail.waitForAlbumLoaded();

      // Close the modal
      await albumDetail.close();

      // Should still be on the catalog page
      await dashboard.expectOnCatalog();
    });
  });
});
