import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Asserts the authority split rotationReleaseList.jsp / rotationReleaseInsert.jsp
 * carry over: the classic rotation list is DJ-readable, the free-text add
 * form is MD-gated. `mainmenu.jsp` places both rotation links outside its
 * hasAdminAccess() block, but Backend requires catalog:['write'] for every
 * rotation write, so the list and the insert form are gated at different
 * authorities -- this spec is what actually exercises that split end to
 * end, rather than trusting the two page-authority unit tests never to
 * disagree about it.
 *
 * Uses the dedicated classicDj/classicMd identities (provisioned in
 * e2e/auth.setup.ts's "provision classic-preference identity" step) rather
 * than the app_state cookie: `setExperienceCookie` is inert on a signed-in
 * context (the account's own appSkin wins on every request once a session
 * resolves), so a real classic-preference account is the only way to reach
 * these pages' classic slot at all.
 */
test.describe("Classic rotation authority split", () => {
  test.describe("DJ", () => {
    test.use({ storageState: path.join(authDir, "classicDj.json") });

    test("reaches the rotation list", async ({ page }) => {
      await page.goto("/dashboard/rotation");

      await expect(page.locator("#classic-container")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Rotation Releases" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Add Rotation Release" })).toBeVisible();
    });

    test("is denied the free-text add form", async ({ page }) => {
      await page.goto("/dashboard/rotation/new");

      // The deny redirect can arrive as a streaming-SSR client redirect (the
      // shell flushes at the gated URL first, the router soft-navigates
      // after hydration) -- poll for the final URL rather than sampling
      // immediately after `goto` resolves, mirroring
      // DashboardPage.expectRedirectedToDefaultDashboard.
      await page.waitForURL(
        (u) => {
          const url = u.toString();
          return !url.includes("/dashboard/rotation/new") && !url.includes("/login");
        },
        { timeout: 15000 },
      );
      expect(page.url()).not.toContain("/dashboard/rotation/new");
    });
  });

  test.describe("Music Director", () => {
    test.use({ storageState: path.join(authDir, "classicMd.json") });

    test("reaches the free-text add form", async ({ page }) => {
      await page.goto("/dashboard/rotation/new");

      await expect(page.locator("#classic-container")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Add this record" })).toBeVisible();
    });

    test("also reaches the rotation list", async ({ page }) => {
      await page.goto("/dashboard/rotation");

      await expect(page.getByRole("heading", { name: "Rotation Releases" })).toBeVisible();
    });
  });
});
