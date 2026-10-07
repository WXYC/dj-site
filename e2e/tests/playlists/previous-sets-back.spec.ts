import path from "path";
import type { Page } from "@playwright/test";
import type {
  FlowsheetRangeResponse,
  PlaylistSearchResponse,
  PlaylistSearchResult,
} from "@wxyc/shared/dtos";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

const PAGE_SIZE = 50;
const ARCHIVE_SIZE = 200;
const FIRST_ROW_ID = 10_000;
/** Comfortably past the first page, so reaching it proves a second one landed. */
const DEEP_ROW = 60;

const ARCHIVE: PlaylistSearchResult[] = Array.from(
  { length: ARCHIVE_SIZE },
  (_, index) => ({
    id: FIRST_ROW_ID + index,
    play_date: new Date(Date.UTC(2026, 0, 1) - index * 60_000).toISOString(),
    artist_name: `Artist ${index + 1}`,
    track_title: `Track ${index + 1}`,
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    dj_name: `DJ ${index % 4}`,
    show_id: 1 + Math.floor(index / 20),
  }),
);

/**
 * Sorts the listing by Date (Oldest), which mounts the ranked table the walk
 * below drives. The default listing is the chronological archive, which reads
 * the stream rather than the search endpoint, so the walk needs a ranked
 * sort — and it has to be the date sort specifically: `sort=date` is the one
 * pagination style the frontend walks by cursor rather than by `page`, which
 * is what lets the cursor assertions below actually fail on a regression.
 * `stubSearch` ignores `sort`/`order` and serves straight off `ARCHIVE`'s own
 * order, so switching the sort option does not change which row lands where.
 */
async function sortByDateOldest(page: Page): Promise<void> {
  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Date (Oldest)", exact: true }).click();
}

/**
 * Answers the archive with a real cursor walk, as `sort=date` is served.
 *
 * Depth is the spec's to choose rather than the seeded database's, which is
 * what makes "several pages in" an assertion rather than an aspiration.
 */
async function stubSearch(page: Page): Promise<string[]> {
  // The recorder lives in the handler that already intercepts every search; a
  // second `page.on("request")` listener would be a parallel answer to "what
  // counts as a search" for a future reader to reconcile.
  const searches: string[] = [];

  await page.route("**/flowsheet/search**", async (route) => {
    searches.push(route.request().url());
    const params = new URL(route.request().url()).searchParams;
    const limit = Number(params.get("limit") ?? PAGE_SIZE);
    const cursor = params.get("cursor");
    const offset = cursor
      ? ARCHIVE.findIndex((row) => row.id === Number(cursor.slice(6))) + 1
      : Number(params.get("page") ?? 0) * limit;
    const results = ARCHIVE.slice(offset, offset + limit);

    const body: PlaylistSearchResponse = {
      results,
      total: ARCHIVE.length,
      page: 0,
      totalPages: Math.ceil(ARCHIVE.length / limit),
      ...(results.length === limit
        ? { nextCursor: `after:${results[results.length - 1].id}` }
        : {}),
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return searches;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Sparse enough that one page spans several daily windows, so a second page is
 * a second walk and not a slice of the first. */
const STREAM_ROWS = 200;
/** Past the first page's rows, so reaching it proves a second page landed. */
const STREAM_DEEP_ROW = 100;

/**
 * Serves the archive stream from an hourly grid hung off the first request's
 * own upper bound, so the fixture never depends on the run's wall clock. The
 * head window reaches a day past `Date.now()`; the grid's newest row is the
 * hour at that "now". Rows run out after `STREAM_ROWS`, and every window past
 * them is empty, so the walk still ends at the archive's start.
 *
 * Returns the requests made, for counting.
 */
async function stubArchiveStream(page: Page): Promise<string[]> {
  const requests: string[] = [];
  let newestMs: number | null = null;

  await page.route("**/flowsheet/range**", async (route) => {
    requests.push(route.request().url());
    const params = new URL(route.request().url()).searchParams;
    const start = Number(params.get("start"));
    const end = Number(params.get("end"));
    newestMs ??= Math.floor((end - DAY_MS) / HOUR_MS) * HOUR_MS;
    const newest = newestMs;

    const entries: FlowsheetRangeResponse["entries"] = [];
    for (let index = STREAM_ROWS - 1; index >= 0; index--) {
      const at = newest - index * HOUR_MS;
      if (at < start || at >= end) continue;
      entries.push({
        id: FIRST_ROW_ID + STREAM_ROWS - index,
        show_id: 1 + Math.floor(index / 20),
        play_order: index,
        add_time: new Date(at).toISOString(),
        entry_type: "track",
        request_flag: false,
        artist_name: `Artist ${index + 1}`,
        track_title: `Track ${index + 1}`,
        album_title: "On Your Own Love Again",
        record_label: "Drag City",
      });
    }

    const body: FlowsheetRangeResponse = { shows: [], entries };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return requests;
}

/** The show a result row opens; its contents are another spec's subject. */
async function stubShow(page: Page): Promise<void> {
  await page.route("**/flowsheet/playlist**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 3,
        show_name: null,
        specialty_show_name: "",
        start_time: "2026-09-08T22:00:00.000Z",
        end_time: "2026-09-09T02:00:00.000Z",
        show_djs: [],
        dj_name_override: null,
        legacy_dj_name: "DJ Chowder",
        entries: [
          {
            id: 5316901,
            show_id: 3,
            play_order: 1,
            add_time: "2026-09-08T23:42:51.752Z",
            entry_type: "track",
            request_flag: false,
            artist_name: "Juana Molina",
            track_title: "la paradoja",
            album_title: "DOGA",
            record_label: "Sonamos",
          },
        ],
      }),
    });
  });
}

/**
 * Scrolls the way a visitor does, and waits for `check` to hold.
 *
 * The gesture has to be a real wheel: `scrollIntoView` moves an overflow:hidden
 * box perfectly well, so it cannot tell a scrollport from a clipped one, and
 * here it would also defeat the very offset under test by setting it directly.
 */
async function wheelUntil(
  page: Page,
  aim: { x: number; y: number },
  // Takes the timeout rather than owning one: an assertion left on its 10s
  // default outlasts the retry budget, and the loop turns once or twice.
  check: (timeout: number) => Promise<void>,
): Promise<void> {
  await page.mouse.move(aim.x, aim.y);
  await expect(async () => {
    await page.mouse.wheel(0, 1500);
    await check(500);
  }).toPass({ timeout: 25_000 });
}

function centreOf(page: Page): { x: number; y: number } {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size to aim the wheel at.");
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/**
 * None of this is assertable outside a browser. The offset is a layout fact,
 * and whether the surface survives a query-only navigation at all is a claim
 * about the router — a component spec drives that branch by hand and so cannot
 * see it. Everything the fix rests on is either here or nowhere.
 */
test.describe("Returning from an archived show — modern", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });
  test.setTimeout(90_000);

  test("restores the listing's offset across back, forward and back", async ({
    page,
  }) => {
    const searches = await stubSearch(page);
    await stubShow(page);

    await page.goto("/dashboard/playlists");
    await sortByDateOldest(page);
    const deepRow = page.getByRole("link", {
      name: new RegExp(`see the full show for Track ${DEEP_ROW} by`),
    });
    const scrollport = page.getByTestId("previous-sets-scrollport");
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();

    await wheelUntil(page, centreOf(page), (timeout) =>
      expect(deepRow).toBeVisible({ timeout }),
    );
    // `toBeVisible` passes for a row with a box, in the viewport or not, and
    // clicking one scrolls it in first. Settling that scroll here is what makes
    // the offset read below the one the listing is actually left at.
    await deepRow.scrollIntoViewIfNeeded();

    const walked = searches.length;
    expect(walked).toBeGreaterThan(1);
    const offset = await scrollport.evaluate((el) => el.scrollTop);
    expect(offset).toBeGreaterThan(0);

    await deepRow.click();
    await expect(page.getByText("Disc Jockey: DJ Chowder")).toBeVisible();

    await page.goBack();

    // The rows below the fold are still rows, not a listing that restarted at
    // the top of page 1 and happens to be scrolled.
    await expect(deepRow).toBeVisible();
    await expect
      .poll(() => scrollport.evaluate((el) => el.scrollTop))
      .toBe(offset);
    expect(searches).toHaveLength(walked);

    // The rows are links, so this is genuine browser history and a forward
    // leg has to survive it too. Asserted here rather than in a second test:
    // standing the scenario up again costs another session and another wheel
    // walk to reach the one navigation that differs.
    await page.goForward();
    await expect(page.getByText("Disc Jockey: DJ Chowder")).toBeVisible();

    await page.goBack();
    await expect(deepRow).toBeVisible();
    await expect
      .poll(() => scrollport.evaluate((el) => el.scrollTop))
      .toBe(offset);
    expect(searches).toHaveLength(walked);
  });

  test("fetches a fresh first page when the screen is arrived at, not returned to", async ({
    page,
  }) => {
    const searches = await stubSearch(page);

    await page.goto("/dashboard/playlists");
    await sortByDateOldest(page);
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();
    const arrived = searches.length;

    await page.goto("/dashboard/catalog");
    await page.goto("/dashboard/playlists");
    await sortByDateOldest(page);
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();

    // Leaving the screen drops the pages, so coming back is an arrival and
    // pays for a fresh first page — the freshness the removed
    // refetch-on-mount used to buy, without its whole-walk price.
    await expect.poll(() => searches.length).toBe(arrived * 2);
    expect(searches.at(-1)).not.toContain("cursor=");
  });
});

/**
 * The default listing reads the archive stream, a walk of `/flowsheet/range`
 * windows that the surface keeps alive across a show visit. The jsdom suite
 * stores any offset it is given, so only a browser can tell a restore that
 * ran once the rows were laid out from one that ran too early and was clamped.
 */
test.describe("Returning to the chronological listing — modern", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });
  test.setTimeout(90_000);

  test("restores the offset and walks no further across back, forward and back", async ({
    page,
  }) => {
    const ranges = await stubArchiveStream(page);
    await stubShow(page);

    await page.goto("/dashboard/playlists");
    const deepRow = page.getByRole("link", {
      name: new RegExp(`see the full show for Track ${STREAM_DEEP_ROW} by`),
    });
    const scrollport = page.getByTestId("previous-sets-scrollport");
    await expect(
      page.getByRole("table", { name: "playlist archive" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();
    const headWalk = ranges.length;

    await wheelUntil(page, centreOf(page), (timeout) =>
      expect(deepRow).toBeVisible({ timeout }),
    );
    // Settles the scroll a click would otherwise make, so the offset read
    // below is the one the listing is left at.
    await deepRow.scrollIntoViewIfNeeded();

    const walked = ranges.length;
    expect(walked).toBeGreaterThan(headWalk);
    const offset = await scrollport.evaluate((el) => el.scrollTop);
    expect(offset).toBeGreaterThan(0);

    await deepRow.click();
    await expect(page.getByText("Disc Jockey: DJ Chowder")).toBeVisible();

    await page.goBack();
    await expect(deepRow).toBeVisible();
    await expect
      .poll(() => scrollport.evaluate((el) => el.scrollTop))
      .toBe(offset);
    expect(ranges).toHaveLength(walked);

    await page.goForward();
    await expect(page.getByText("Disc Jockey: DJ Chowder")).toBeVisible();

    await page.goBack();
    await expect(deepRow).toBeVisible();
    await expect
      .poll(() => scrollport.evaluate((el) => el.scrollTop))
      .toBe(offset);
    expect(ranges).toHaveLength(walked);
  });
});

/**
 * Classic does not ride window scroll, which is the thing worth pinning here:
 * `html, body` clip their overflow and `#classic-container` is where
 * `src/styles/globals.css` puts the scrollport back, so classic's offset is an
 * inner one exactly as modern's is and the browser restores neither.
 */
test.describe("Returning from an archived show — classic", () => {
  test.use({ storageState: path.join(authDir, "classicDj.json") });
  test.setTimeout(90_000);

  test("restores the shell scrollport's offset and re-runs no search", async ({
    page,
  }) => {
    const searches = await stubSearch(page);
    await stubShow(page);

    await page.goto("/dashboard/playlists");
    const deepRow = page.getByRole("link", {
      name: new RegExp(`see the full show for Track ${DEEP_ROW} by`),
    });
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();

    await wheelUntil(page, centreOf(page), (timeout) =>
      expect(deepRow).toBeVisible({ timeout }),
    );
    // `toBeVisible` passes for a row with a box, in the viewport or not, and
    // clicking one scrolls it in first. Settling that scroll here is what makes
    // the offset read below the one the listing is actually left at.
    await deepRow.scrollIntoViewIfNeeded();

    const walked = searches.length;
    expect(walked).toBeGreaterThan(1);
    const shell = page.locator("#classic-container");
    const offset = await shell.evaluate((el) => el.scrollTop);
    expect(offset).toBeGreaterThan(0);

    await deepRow.click();
    await expect(page.getByText("Disc Jockey: DJ Chowder")).toBeVisible();

    await page.goBack();

    await expect(deepRow).toBeVisible();
    await expect.poll(() => shell.evaluate((el) => el.scrollTop)).toBe(offset);
    expect(searches).toHaveLength(walked);
  });
});
