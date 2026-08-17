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
 *  3. Id space: a card-catalog row, whose `library.id` and `legacy_release_id`
 *     differ, shows its own tracklist rather than the unrelated release its
 *     `library.id` resolves to in the other space.
 *
 * Mocks the LML proxy endpoints (`/proxy/library/search`,
 * `/proxy/library/:id/tracks`) and the flowsheet POST so the spec doesn't
 * depend on LML being running or on specific catalog data being seeded.
 *
 * Uses musicDirector to avoid live-state conflicts with entry-caching tests
 * (which toggle dj2 live/off-air) and session conflicts with auth tests
 * (which invalidate dj.json) — same pattern as library-search-proxy.spec.ts.
 */
test.describe("Flowsheet Track Picker", { tag: "@smoke" }, () => {
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

  // URL predicate for the legacy /library/ catalog endpoint (NOT the
  // /proxy/library/* LML proxy). Used to suppress card-catalog results so
  // the LML mock row reliably lands at a known index.
  const isCatalogSearch = (url: URL) =>
    url.pathname.endsWith("/library/") &&
    !url.pathname.includes("/proxy/");

  test("picks a tracklisted release and submits track_title + track_position; the LML write-gate withholds album_id", async ({
    page,
  }) => {
    const LIBRARY_ID = 12345;

    // Suppress card-catalog results so only the LML mock populates the
    // result list (otherwise a seeded backend could shift the positional
    // index of the picker target row).
    await page.route(isCatalogSearch, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fallback();
      }
    });

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

    // Hover only prefetches now; clicking commits the release into the query
    // (freeze), which is the signal the picker reads.
    await resultRow.click();

    // Picker row appears below the result list once a release is highlighted.
    await expect(
      page.locator('[data-testid="flowsheet-search-track-picker-row"]')
    ).toBeVisible({ timeout: 5_000 });

    // Once the tracklist resolves with tracks.length > 0, the combobox renders.
    const pickerTrigger = page.locator(
      '[data-testid="track-picker-combobox"]'
    );
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

    // The LML-sourced row submits freeform: its `id` is a legacy id, so the
    // interim write-gate withholds album_id rather than persist a
    // wrong-space album link. The pick itself survives — track_position
    // rides the freeform variant when the read-half legacy id it was picked
    // from rides beside it, and the picker stayed offered on that same read
    // half. Only the linkage is withheld.
    expect(postBody).not.toBeNull();
    expect(postBody).toMatchObject({
      track_title: "la paradoja",
      track_position: "A1",
      artist_name: "Juana Molina",
      album_title: "DOGA",
    });
    expect(postBody).not.toHaveProperty("album_id");
  });

  test("shows the catalog row's own tracklist, not the one its library.id resolves to", async ({
    page,
  }) => {
    // The two sibling tests both source their release from the library-search
    // proxy, where the row's `id` and its `legacy_release_id` happen to be the
    // same number — so neither can tell the two id spaces apart. A card-catalog
    // row is where they diverge, and where reading the wrong one returns a real
    // but unrelated release's tracklist with a 200.
    const LIBRARY_ID = 1234;
    const LEGACY_RELEASE_ID = 45342;

    // Suppress the library-search proxy so only the catalog row populates the
    // list and lands at a known index.
    await page.route("**/proxy/library/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], total: 0, query: null }),
      });
    });

    await page.route(isCatalogSearch, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: LIBRARY_ID,
            legacy_release_id: LEGACY_RELEASE_ID,
            add_date: "2026-05-01T00:00:00.000Z",
            album_title: "On Your Own Love Again",
            artist_name: "Jessica Pratt",
            code_letters: "PR",
            code_artist_number: 3,
            code_number: 1,
            format_name: "Vinyl",
            genre_name: "Rock",
            label: "Drag City",
            plays: 4,
          },
        ]),
      });
    });

    // Both id spaces answer, with different tracklists. Stubbing only the
    // correct one would let a wrong-space read fail as an unrouted request —
    // which surfaces as a collapsed picker, not as the wrong answer it is.
    await page.route(`**/proxy/library/${LIBRARY_ID}/tracks`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          library_id: LIBRARY_ID,
          discogs_release_id: 111111,
          source: "discogs",
          tracks: [
            {
              position: "B2",
              title: "WRONG RELEASE",
              artist_credit: "Someone Else",
              duration_ms: null,
            },
          ],
        }),
      });
    });

    await page.route(
      `**/proxy/library/${LEGACY_RELEASE_ID}/tracks`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            library_id: LEGACY_RELEASE_ID,
            discogs_release_id: 222222,
            source: "discogs",
            tracks: [
              {
                position: "A1",
                title: "Wrong Hand",
                artist_credit: "Jessica Pratt",
                duration_ms: 168000,
              },
            ],
          }),
        });
      }
    );

    await flowsheet.songInput.click();
    await flowsheet.artistInput.fill("Jessica Pratt");
    await flowsheet.albumInput.fill("On Your Own Love Again");

    // Located by content rather than by index: bin and rotation results are
    // not mocked here, so a seeded row matching this artist would shift the
    // positional index and silently click the wrong release.
    const resultRow = page
      .locator('[data-testid^="flowsheet-search-result-"]')
      .filter({ hasText: "On Your Own Love Again" })
      .first();
    await expect(resultRow).toBeVisible({ timeout: 10_000 });
    await resultRow.click();

    const pickerTrigger = page.locator('[data-testid="track-picker-combobox"]');
    await expect(pickerTrigger).toBeVisible({ timeout: 10_000 });
    await pickerTrigger.click();
    await expect(
      page.locator('[data-testid="track-picker-panel"]')
    ).toBeVisible();

    // The release the DJ clicked, not the one its library.id collides with.
    await expect(
      page.locator('[data-testid="track-picker-option-0"]')
    ).toContainText("Wrong Hand");
    await expect(
      page.locator('[data-testid="track-picker-panel"]')
    ).not.toContainText("WRONG RELEASE");
  });

  test("falls back to free-text song input when the release has no tracklist", async ({
    page,
  }) => {
    const LIBRARY_ID = 54321;

    // Suppress card-catalog results (see comment on the previous test).
    await page.route(isCatalogSearch, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fallback();
      }
    });

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
    await resultRow.click();

    // Picker row visible, but the combobox never renders — the fallback
    // message replaces it.
    await expect(
      page.locator('[data-testid="flowsheet-search-track-picker-row"]')
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="track-picker-combobox"]')
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
      artist_name: "Chuquimamani-Condori",
      album_title: "Edits",
    });
    // LML-sourced row → the interim write-gate withholds album_id (see
    // AlbumEntry.lml_source).
    expect(postBody).not.toHaveProperty("album_id");
    // No track was picked → no Discogs position was forwarded.
    expect(postBody).not.toHaveProperty("track_position");
  });
});
