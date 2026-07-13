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
    const artistsOption = page.getByRole("option", { name: "Artists", exact: true });
    await artistsOption.waitFor({ state: "visible", timeout: 10000 });
    await artistsOption.click();

    const firstInput = page.getByTestId("catalog-search-input");
    await firstInput.fill("Juana Molina");

    await expect.poll(() => queryHits).toBeGreaterThan(0);

    await page.getByTestId("catalog-search-add-row").click();

    const textboxes = page.getByRole("textbox");
    const secondInput = textboxes.nth(1);
    const row1FieldCombo = page
      .getByRole("combobox")
      .filter({ hasText: "Artists" })
      .last();
    await row1FieldCombo.click();
    const labelsOption = page.getByRole("option", { name: "Labels", exact: true });
    await labelsOption.waitFor({ state: "visible", timeout: 10000 });
    await labelsOption.click();
    await secondInput.fill("Sonamos");

    const resultRow = page
      .locator("#OrderTableContainer tbody tr")
      .filter({ hasText: "DOGA" });
    await expect(resultRow).toBeVisible({ timeout: 10000 });
    // The artist renders twice within a desktop row (stacked in the Album
    // column below xl, its own column at xl); target the visible copy so the
    // assertion is viewport-independent.
    await expect(
      resultRow
        .getByText("Juana Molina", { exact: true })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();

    await expect.poll(() => lastQ ?? "").toMatch(/artist:Juana Molina/);
    await expect.poll(() => lastQ ?? "").toMatch(/AND/);
    await expect.poll(() => lastQ ?? "").toMatch(/label:Sonamos/);
  });
});
