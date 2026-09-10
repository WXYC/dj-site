import path from "path";
import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

const SHOW_ID = 1951321;
/** Long enough to outrun any viewport this suite runs at. */
const ENTRY_COUNT = 60;

const LAST_ENTRY_ID = 5316900 + ENTRY_COUNT;

/**
 * Answers the archive with one long show.
 *
 * The entries are V2-projected, as the route emits them, so the page converts
 * them through the same path a real set takes.
 */
async function stubShow(page: Page): Promise<void> {
  const entries = Array.from({ length: ENTRY_COUNT }, (_, index) => ({
    id: 5316901 + index,
    show_id: SHOW_ID,
    play_order: index + 1,
    add_time: "2026-09-08T23:42:51.752Z",
    entry_type: "track" as const,
    request_flag: false,
    artist_name: `Artist ${index + 1}`,
    track_title: `Track ${index + 1}`,
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
  }));

  await page.route(`**/flowsheet/playlist**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: SHOW_ID,
        show_name: null,
        specialty_show_name: "",
        start_time: "2026-09-08T22:00:00.000Z",
        end_time: "2026-09-09T02:00:00.000Z",
        show_djs: [],
        dj_name_override: null,
        legacy_dj_name: "DJ Chowder",
        entries,
      }),
    });
  });
}

/**
 * Scrolls the set the way a visitor does, and waits for `check` to hold.
 *
 * The gesture has to be a real wheel. `scrollIntoViewIfNeeded` and
 * `scrollIntoView` both move an overflow:hidden box perfectly well, so they
 * cannot tell a clipped layout from a scrollable one — under the clipped one
 * they reach the row a visitor cannot reach, and pass.
 */
async function wheelUntil(
  page: Page,
  // Takes the timeout rather than owning one: an assertion left on its 10s
  // default outlasts the retry budget, and the loop turns once or twice instead
  // of scrolling the set.
  check: (timeout: number) => Promise<void>
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("No viewport size to aim the wheel at.");

  // The set occupies the middle column; the sidebars are their own scrollports
  // and a wheel delivered over one of them proves nothing about this page.
  await page.mouse.move(viewport.width / 2, viewport.height / 2);

  await expect(async () => {
    await page.mouse.wheel(0, 1200);
    await check(500);
  }).toPass({ timeout: 20_000 });
}

/**
 * The dashboard's main column is a fixed 100dvh box with overflow:hidden, so a
 * page that owns no scroll container has its overflow clipped away with no way
 * to reach it. jsdom resolves none of that — it neither applies the ancestor's
 * clamp nor lays anything out — so the fact that a long set is *reachable*
 * can only be asserted in a browser.
 */
test.describe("Archived show scrolling", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await stubShow(page);
    await page.goto(`/dashboard/playlists?show=${SHOW_ID}`);
    await expect(page.getByTestId("flowsheet-entry-5316901")).toBeVisible();
  });

  test("bounds the set to the viewport so it scrolls instead of clipping", async ({
    page,
  }) => {
    const pane = await page
      .getByRole("table", { name: "show entries" })
      .evaluateHandle((table) => {
        let node = table.parentElement;
        while (node && getComputedStyle(node).overflowY !== "auto") {
          node = node.parentElement;
        }
        return node;
      });

    const bounds = await pane.evaluate((node: HTMLElement | null) =>
      node
        ? {
            bottom: node.getBoundingClientRect().bottom,
            viewport: window.innerHeight,
            scrollable: node.scrollHeight > node.clientHeight,
          }
        : null
    );

    expect(bounds).not.toBeNull();
    expect(bounds!.scrollable).toBe(true);
    // Sub-pixel layout rounding, not a tolerance for overhang.
    expect(bounds!.bottom).toBeLessThanOrEqual(bounds!.viewport + 1);
  });

  test("reaches the last row of a long set by scrolling", async ({ page }) => {
    const lastRow = page.getByTestId(`flowsheet-entry-${LAST_ENTRY_ID}`);

    // The set is longer than the viewport, which is what makes the rest of this
    // a question at all.
    await expect(lastRow).not.toBeInViewport();

    await wheelUntil(page, (timeout) => expect(lastRow).toBeInViewport({ timeout }));
  });

  test("scrolls the show's header away with the set", async ({ page }) => {
    const header = page.getByRole("heading", { level: 2, name: "DJ Chowder" });
    await expect(header).toBeInViewport();

    // Pinned, it would stay. It belongs to the set, and the week view above
    // scrolls its own header the same way.
    await wheelUntil(page, (timeout) =>
      expect(header).not.toBeInViewport({ timeout })
    );
  });
});
