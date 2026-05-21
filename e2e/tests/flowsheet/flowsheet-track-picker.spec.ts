import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Flowsheet Track Picker E2E Tests
 *
 * Two end-to-end paths through the picker that PR #561 / WXYC/dj-site#501
 * introduced:
 *
 *  1. Happy path: DJ picks a release with a Discogs tracklist → picker renders
 *     → DJ picks a track → submission carries both `track_title` (legacy
 *     compat) and `track_position` (Discogs `release_track.position`).
 *  2. Free-text fallback: DJ picks a release with no Discogs identity /
 *     empty tracklist → picker collapses to "type the song title above" →
 *     submission carries `track_title` but no `track_position`.
 *
 * Mocks the LML proxy endpoints (`/proxy/library/search`,
 * `/proxy/library/:id/tracks`) and the flowsheet POST so the spec doesn't
 * depend on LML being running or on specific catalog data being seeded.
 *
 * Uses musicDirector to avoid live-state conflicts with entry-caching tests
 * (which toggle dj2 live/off-air) and session conflicts with auth tests
 * (which invalidate dj.json) — same pattern as library-search-proxy.spec.ts.
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

  test("picks a tracklisted release and submits track_title + track_position", async ({
    page,
  }) => {
    const LIBRARY_ID = 12345;

    // Mock library search → one Juana Molina release.
    await page.route("**/proxy/library/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
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
            },
          ],
          total: 1,
          query: "Juana Molina",
        }),
      });
    });

    // Mock tracklist → 3 tracks from the Discogs identity.
    await page.route(`**/proxy/library/${LIBRARY_ID}/tracks`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          library_id: LIBRARY_ID,
          discogs_release_id: 9876543,
          source: "discogs",
          tracks: [
            {
              position: "A1",
              title: "la paradoja",
              artist_credit: "Juana Molina",
              duration_ms: 245000,
            },
            {
              position: "A2",
              title: "vibora",
              artist_credit: "Juana Molina",
              duration_ms: 198000,
            },
            {
              position: "B1",
              title: "doga",
              artist_credit: "Juana Molina",
              duration_ms: 312000,
            },
          ],
        }),
      });
    });

    // Capture the flowsheet POST so we can assert the submission shape.
    let postBody: Record<string, unknown> | null = null;
    await page.route("**/flowsheet/", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          postBody = req.postDataJSON();
        } catch {
          postBody = null;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 99999,
            entry_type: "track",
            play_order: 1,
            show_id: 1,
            track_title: postBody?.track_title ?? "",
            artist_name: postBody?.artist_name ?? "",
            album_title: postBody?.album_title ?? "",
            record_label: postBody?.record_label ?? "",
            request_flag: false,
          }),
        });
      } else {
        await route.fallback();
      }
    });

    // Open search and type enough to trigger the debounced library search.
    await flowsheet.songInput.click();
    await flowsheet.artistInput.fill("Juana Molina");
    await flowsheet.albumInput.fill("DOGA");

    // The result row appears at index 1 (index 0 = NewEntryPreview) once the
    // mocked search response lands.
    const resultRow = page.locator('[data-testid="flowsheet-search-result-1"]');
    await expect(resultRow).toBeVisible({ timeout: 10_000 });

    // Hovering highlights the row (setSelectedResult) and prefetches the
    // tracklist — both signals the picker reads.
    await resultRow.hover();

    // Picker row appears below the result list once a release is highlighted.
    await expect(
      page.locator('[data-testid="flowsheet-search-track-picker-row"]')
    ).toBeVisible({ timeout: 5_000 });

    // Once the tracklist resolves with tracks.length > 0, the trigger renders.
    const pickerTrigger = page.locator('[data-testid="track-picker-trigger"]');
    await expect(pickerTrigger).toBeVisible({ timeout: 10_000 });

    // Open the dropdown and pick the first track.
    await pickerTrigger.click();
    await expect(
      page.locator('[data-testid="track-picker-panel"]')
    ).toBeVisible();
    await page.locator('[data-testid="track-picker-option-0"]').click();

    // Picked track title is mirrored into the song input via Redux.
    await expect(flowsheet.songInput).toHaveValue("la paradoja");

    // Submit through the form's onSubmit (Enter on song input).
    const postResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 15_000 }
    );
    await flowsheet.songInput.press("Enter");
    await postResponse;

    // Both legacy compat field and new track_position are present, and the
    // highlighted release's id is forwarded as album_id.
    expect(postBody).not.toBeNull();
    expect(postBody).toMatchObject({
      track_title: "la paradoja",
      track_position: "A1",
      album_id: LIBRARY_ID,
      artist_name: "Juana Molina",
      album_title: "DOGA",
    });
  });

  test("falls back to free-text song input when the release has no tracklist", async ({
    page,
  }) => {
    const LIBRARY_ID = 54321;

    await page.route("**/proxy/library/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
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
            },
          ],
          total: 1,
          query: "Chuquimamani-Condori",
        }),
      });
    });

    // No Discogs identity — picker should collapse to the free-text message.
    await page.route(`**/proxy/library/${LIBRARY_ID}/tracks`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          library_id: LIBRARY_ID,
          discogs_release_id: null,
          source: null,
          tracks: [],
        }),
      });
    });

    let postBody: Record<string, unknown> | null = null;
    await page.route("**/flowsheet/", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          postBody = req.postDataJSON();
        } catch {
          postBody = null;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 99998,
            entry_type: "track",
            play_order: 1,
            show_id: 1,
            track_title: postBody?.track_title ?? "",
            artist_name: postBody?.artist_name ?? "",
            album_title: postBody?.album_title ?? "",
            record_label: postBody?.record_label ?? "",
            request_flag: false,
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await flowsheet.songInput.click();
    await flowsheet.artistInput.fill("Chuquimamani-Condori");
    await flowsheet.albumInput.fill("Edits");

    const resultRow = page.locator('[data-testid="flowsheet-search-result-1"]');
    await expect(resultRow).toBeVisible({ timeout: 10_000 });
    await resultRow.hover();

    // Picker row visible, but the trigger never renders — the fallback
    // message replaces it.
    await expect(
      page.locator('[data-testid="flowsheet-search-track-picker-row"]')
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="track-picker-trigger"]')
    ).toHaveCount(0);
    await expect(
      page.getByText("No tracklist on file — type the song title above.")
    ).toBeVisible();

    // DJ types into the free-text song input as instructed.
    await flowsheet.songInput.fill("Call Your Name");

    const postResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 15_000 }
    );
    await flowsheet.songInput.press("Enter");
    await postResponse;

    expect(postBody).not.toBeNull();
    expect(postBody).toMatchObject({
      track_title: "Call Your Name",
      album_id: LIBRARY_ID,
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
    });
    // No track was picked → no Discogs position was forwarded.
    expect(postBody).not.toHaveProperty("track_position");
  });
});
