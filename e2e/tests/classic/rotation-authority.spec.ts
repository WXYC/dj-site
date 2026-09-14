import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Asserts the authority split rotationReleaseList.jsp,
 * rotationReleaseInsert.jsp and rotationReleaseModify.jsp carry over: the
 * classic rotation list is DJ-readable, the free-text add form and the
 * release editor are MD-gated. `mainmenu.jsp` places both rotation links
 * outside its hasAdminAccess() block, but Backend requires
 * catalog:['write'] for every rotation write, so the list and the two write
 * surfaces are gated at different authorities -- this spec is what actually
 * exercises that split end to end, rather than trusting the page-authority
 * unit tests never to disagree about it.
 *
 * The list itself is DJ-readable, but its own write affordances -- the row
 * Edit/Import/Kill/Unkill controls and the header's "Add Rotation Release"
 * link -- are a fourth write surface at the same MD authority as the other
 * three, resolved server-side in the page and threaded down as `canWrite`.
 * A DJ seeing any of them was the defect this split closes: Backend already
 * refused the writes, so the previous "Add Rotation Release" visibility
 * assertion below was the bug written down as a passing test.
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

    test("reaches the rotation list with no write affordances", async ({ page }) => {
      await page.goto("/dashboard/rotation");

      await expect(page.locator("#classic-container")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("heading", { name: "Rotation Releases" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Add Rotation Release" })).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("columnheader", { name: "Actions" })).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("link", { name: /^Edit: / })).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("link", { name: /^Import: / })).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: /^Kill: / })).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("button", { name: /^Unkill: / })).not.toBeVisible({ timeout: 5000 });
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

    test("is denied the release editor", async ({ page }) => {
      await page.goto("/dashboard/rotation/1");

      await page.waitForURL(
        (u) => {
          const url = u.toString();
          return !url.includes("/dashboard/rotation/1") && !url.includes("/login");
        },
        { timeout: 15000 },
      );
      expect(page.url()).not.toContain("/dashboard/rotation/1");
    });
  });

  test.describe("Music Director", () => {
    test.use({ storageState: path.join(authDir, "classicMd.json") });

    test("reaches the free-text add form", async ({ page }) => {
      await page.goto("/dashboard/rotation/new");

      await expect(page.locator("#classic-container")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "Add this record" })).toBeVisible();
    });

    test("also reaches the rotation list, with its write affordances intact", async ({ page }) => {
      await page.goto("/dashboard/rotation");

      await expect(page.getByRole("heading", { name: "Rotation Releases" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Add Rotation Release" })).toBeVisible();
    });

    // Asserted on the screen's header links rather than on its form, so the
    // test states the authority split without depending on rotation row 1
    // existing in the seeded database.
    test("reaches the release editor", async ({ page }) => {
      await page.goto("/dashboard/rotation/1");

      await expect(page.locator("#classic-container")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("link", { name: "Rotation Release List" })).toBeVisible();
      expect(page.url()).toContain("/dashboard/rotation/1");
    });
  });
});
