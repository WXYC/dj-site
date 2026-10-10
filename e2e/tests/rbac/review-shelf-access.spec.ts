import { test, expect } from "../../fixtures/auth.fixture";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

// The browser resolves the station role from the auth JWT, not from auth_user.role
// (the admin flag, null for a music director), so the lanes must render for both.
for (const [name, storageState] of [
  ["music director", "musicDirector.json"],
  ["station manager", "stationManager.json"],
] as const) {
  test.describe(`Review shelf lanes: ${name}`, () => {
    test.use({ storageState: path.join(authDir, storageState) });

    test("renders the review shelf and the logging form on the Reviews page", async ({ page }) => {
      await page.goto("/dashboard/reviews");

      await expect(page.getByRole("heading", { name: "Reviews" }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("region", { name: "The review shelf" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("form", { name: "Log an item" })).toBeVisible();
    });

    test("renders the music directors' lanes on the second tab", async ({ page }) => {
      await page.goto("/dashboard/reviews/music-directors");

      await expect(page.getByRole("region", { name: "Filed" })).toBeVisible({ timeout: 15000 });
    });

    test("forwards the old review shelf address to the second tab", async ({ page }) => {
      await page.goto("/dashboard/admin/intake");

      await expect(page).toHaveURL(/\/dashboard\/reviews\/music-directors$/, { timeout: 15000 });
    });
  });
}
