import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";

const authDir = path.join(__dirname, "../../.auth");

const MOCK_ROW = {
  id: 4242,
  album_title: "DOGA",
  artist_name: "Juana Molina",
  code_artist_number: 42,
  code_letters: "RO",
  code_number: 1,
  format_name: "CD",
  genre_name: "Rock",
  label: "Sonamos",
  plays: 17,
  add_date: "2023-08-15",
};

test.describe("Catalog query builder", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });

  test("builds a 2-row artist:foo AND label:bar query and shows results", async ({
    page,
  }) => {
    let lastQ: string | null = null;
    let queryHits = 0;

    await page.route("**/library/query**", async (route) => {
      const url = new URL(route.request().url());
      lastQ = url.searchParams.get("q");
      queryHits += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [MOCK_ROW],
          total: 1,
          page: 0,
          totalPages: 1,
        }),
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.gotoCatalog();
    await dashboard.waitForPageLoad();

    const fieldSelect = page.getByTestId("catalog-search-field");
    await fieldSelect.click();
    await page.getByRole("option", { name: "ARTISTS", exact: true }).click();

    const firstInput = page.getByTestId("catalog-search-input");
    await firstInput.fill("Juana Molina");

    await expect.poll(() => queryHits).toBeGreaterThan(0);

    await page.getByTestId("catalog-search-add-row").click();

    const textboxes = page.getByRole("textbox");
    const secondInput = textboxes.nth(1);
    const row1FieldCombo = page.getByRole("combobox").filter({ hasText: "ARTISTS" }).last();
    await row1FieldCombo.click();
    await page.getByRole("option", { name: "LABELS", exact: true }).click();
    await secondInput.fill("Sonamos");

    await expect(page.getByText("DOGA")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Juana Molina")).toBeVisible();

    await expect.poll(() => lastQ ?? "").toMatch(/artist:Juana Molina/);
    await expect.poll(() => lastQ ?? "").toMatch(/AND/);
    await expect.poll(() => lastQ ?? "").toMatch(/label:Sonamos/);
  });
});
