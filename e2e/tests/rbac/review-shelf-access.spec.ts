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

    test("renders the review shelf's lanes", async ({ page }) => {
      await page.goto("/dashboard/admin/intake");

      await expect(page.getByRole("heading", { name: "Review shelf" }).first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("region", { name: "On the review shelf" })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("region", { name: "Filed" })).toBeVisible();
    });
  });
}
