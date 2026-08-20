import { test, expect } from "@playwright/test";
import { LoginPage } from "../../pages/login.page";

/**
 * These drive the mouse wheel rather than scrollIntoView: an `overflow: hidden`
 * box still has a scrollport, so programmatic scrolling succeeds on a page the
 * user has no way to scroll. Only a real scroll container answers the wheel.
 */
test.describe("Login page overflow", () => {
  test("scrolls to the footer on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await new LoginPage(page).goto();

    // Located by tag, not by the contentinfo role: the shell nests this footer
    // inside <main>, which strips its landmark mapping.
    const footer = page.locator("footer");
    await expect(footer).not.toBeInViewport();

    await page.mouse.move(195, 250);
    await page.mouse.wheel(0, 2000);

    await expect(footer).toBeInViewport();
  });

  test("shows the whole page without scrolling when it fits", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await new LoginPage(page).goto();

    await expect(page.locator("footer")).toBeInViewport();
  });
});
