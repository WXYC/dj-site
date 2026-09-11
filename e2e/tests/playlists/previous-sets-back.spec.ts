import path from "path";
import type { Page } from "@playwright/test";
import type {
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

    const body: PlaylistSearchResponse & { nextCursor?: string } = {
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
    await expect(
      page.getByRole("link", { name: /see the full show for Track 1 by/ }),
    ).toBeVisible();
    const arrived = searches.length;

    await page.goto("/dashboard/catalog");
    await page.goto("/dashboard/playlists");
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
