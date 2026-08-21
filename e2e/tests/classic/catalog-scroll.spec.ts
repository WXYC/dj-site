import { test, expect } from "@playwright/test";

/**
 * Drives the mouse wheel rather than scrollIntoView: an `overflow: hidden` box
 * still has a scrollport, so programmatic scrolling succeeds on a page the user
 * has no way to scroll. Only a real scroll container answers the wheel.
 *
 * The shell clips its own overflow so the dashboard can own internal scroll
 * regions. Modern carries those inside its panels; classic is plain HTML and
 * has none, so a result list longer than the viewport is unreachable unless the
 * classic container is itself a scrollport.
 */
test.describe("Classic catalog overflow", () => {
  test("scrolls to the last result on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    // A query broad enough that the result table exceeds the viewport.
    await page.goto("/dashboard/catalog?searchString=james");

    const rows = page.locator("#liveResults table.entry-table tbody tr");
    await expect(rows.first()).toBeVisible();
    const lastRow = rows.last();
    await expect(lastRow).not.toBeInViewport();

    await page.mouse.move(512, 250);
    await page.mouse.wheel(0, 4000);

    await expect(lastRow).toBeInViewport();
  });
});
