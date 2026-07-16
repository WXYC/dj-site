import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Flowsheet Track Picker E2E (v2 smart entry)
 *
 * The track_title + track_position contract from PR #561 / WXYC/dj-site#501,
 * driven through the v2 smart composer instead of the old segmented bar:
 *
 *  1. Happy path: type artist/album, click the matching result (fills the
 *     sentence), the tracklist affordance appears under the "Selected match",
 *     pick a track → the submission carries track_title + track_position +
 *     album_id.
 *  2. Free-text fallback: a release with no Discogs tracklist shows no track
 *     picker; the DJ's typed song is submitted with no track_position.
 *
 * Mocks the LML proxy search + tracklist, suppresses the /library/query catalog
 * search (so the LML row is the only result), and captures the flowsheet POST.
 * musicDirector session (kept off dj/dj2) as in library-search-proxy.spec.ts.
 */
test.describe("Flowsheet Track Picker", () => {
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

  const composer = (page: import("@playwright/test").Page) =>
    page.locator('[data-testid="flowsheet-composer"]');

  // Suppress the /library/query catalog search so only the mocked LML row lands.
  const suppressCatalogQuery = (page: import("@playwright/test").Page) =>
    page.route("**/library/query**", async (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ results: [], total: 0, page: 0, totalPages: 0 }),
          })
        : route.fallback()
    );

  const mockLmlRelease = (
    page: import("@playwright/test").Page,
    release: Record<string, unknown>
  ) =>
    page.route("**/proxy/library/search**", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [release], total: 1, query: "" }),
      })
    );

  const capturePost = async (page: import("@playwright/test").Page) => {
    const captured: { body: Record<string, unknown> | null } = { body: null };
    await page.route("**/flowsheet/", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          captured.body = req.postDataJSON();
        } catch {
          captured.body = null;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 99999,
            entry_type: "track",
            play_order: 1,
            show_id: 1,
            track_title: captured.body?.track_title ?? "",
            artist_name: captured.body?.artist_name ?? "",
            album_title: captured.body?.album_title ?? "",
            record_label: captured.body?.record_label ?? "",
            request_flag: false,
          }),
        });
      } else {
        await route.fallback();
      }
    });
    return captured;
  };

  test("picks a tracklisted release and submits track_title + track_position", async ({
    page,
  }) => {
    const LIBRARY_ID = 12345;

    await suppressCatalogQuery(page);
    await mockLmlRelease(page, {
      id: LIBRARY_ID,
      title: "DOGA",
      artist: "Juana Molina",
      call_letters: "RO",
      artist_call_number: 42,
      release_call_number: 1,
      genre: "Rock",
      format: "CD",
      alternate_artist_name: null,
      label: "Sonamos",
      on_streaming: true,
      call_number: "Rock CD RO 42/1",
      library_url: `http://www.wxyc.info/wxycdb/libraryRelease?id=${LIBRARY_ID}`,
    });
    await page.route(`**/proxy/library/${LIBRARY_ID}/tracks`, async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          library_id: LIBRARY_ID,
          discogs_release_id: 9876543,
          source: "discogs",
          tracks: [
            { position: "A1", title: "la paradoja", artist_credit: "Juana Molina", duration_ms: 245000 },
            { position: "A2", title: "vibora", artist_credit: "Juana Molina", duration_ms: 198000 },
          ],
        }),
      })
    );
    const captured = await capturePost(page);

    await composer(page).click();
    await composer(page).fill("by Juana Molina on DOGA");

    // The matching release shows in the results; click it to fill the sentence.
    const resultRow = page
      .locator('[data-testid^="flowsheet-search-result-"]', { hasText: "DOGA" })
      .first();
    await expect(resultRow).toBeVisible({ timeout: 10_000 });
    await resultRow.click();

    // The tracklist affordance appears under the promoted match; pick a track.
    const trackA1 = page.locator('[data-testid="flowsheet-track-option-A1"]');
    await expect(trackA1).toBeVisible({ timeout: 10_000 });
    await trackA1.click();

    await expect(composer(page)).toHaveValue(/la paradoja/);

    const postResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 15_000 }
    );
    await composer(page).press("Enter");
    await postResponse;

    expect(captured.body).not.toBeNull();
    expect(captured.body).toMatchObject({
      track_title: "la paradoja",
      track_position: "A1",
      album_id: LIBRARY_ID,
      artist_name: "Juana Molina",
      album_title: "DOGA",
    });
  });

  test("submits a typed song with no track_position when the release has no tracklist", async ({
    page,
  }) => {
    const LIBRARY_ID = 54321;

    await suppressCatalogQuery(page);
    await mockLmlRelease(page, {
      id: LIBRARY_ID,
      title: "Edits",
      artist: "Chuquimamani-Condori",
      call_letters: "EL",
      artist_call_number: 15,
      release_call_number: 1,
      genre: "Electronic",
      format: "CD",
      alternate_artist_name: null,
      label: "self-released",
      on_streaming: true,
      call_number: "Electronic CD EL 15/1",
      library_url: `http://www.wxyc.info/wxycdb/libraryRelease?id=${LIBRARY_ID}`,
    });
    await page.route(`**/proxy/library/${LIBRARY_ID}/tracks`, async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          library_id: LIBRARY_ID,
          discogs_release_id: null,
          source: null,
          tracks: [],
        }),
      })
    );
    const captured = await capturePost(page);

    // Type the song up front — with no tracklist the DJ authors it.
    await composer(page).click();
    await composer(page).fill("Call Your Name by Chuquimamani-Condori on Edits");

    const resultRow = page
      .locator('[data-testid^="flowsheet-search-result-"]', { hasText: "Edits" })
      .first();
    await expect(resultRow).toBeVisible({ timeout: 10_000 });
    await resultRow.click();

    // No Discogs tracklist → no track picker.
    await expect(
      page.locator('[data-testid="flowsheet-track-picker"]')
    ).toHaveCount(0);

    const postResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 15_000 }
    );
    await composer(page).press("Enter");
    await postResponse;

    expect(captured.body).not.toBeNull();
    expect(captured.body).toMatchObject({
      track_title: "Call Your Name",
      album_id: LIBRARY_ID,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
    });
    expect(captured.body).not.toHaveProperty("track_position");
  });
});
