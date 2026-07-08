import { test, expect } from "@playwright/test";

test.describe("flowsheet keyboard entry", () => {
  test.skip(!process.env.E2E_BASE_URL, "requires running app");

  test("keyboard-only entry path", async ({ page }) => {
    await page.goto("/dashboard/flowsheet");
    const artist = page.getByTestId("flowsheet-search-artist");
    await artist.focus();
    await artist.fill("Test Artist");
    await page.keyboard.press("Tab");
    const song = page.getByTestId("flowsheet-search-song");
    await expect(song).toBeFocused();
    await song.fill("Test Song");
    await page.keyboard.press("Enter");
  });
});
