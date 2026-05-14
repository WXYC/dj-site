import path from "path";
import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Mock catalog query response for a 2-row `artist:foo AND label:bar` build.
 * Backend returns `{ results, total, page, totalPages }` per
 * LibraryQueryResponse.
 */
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

    // Row 0: artist:Juana Molina.
    const firstField = page.getByRole("combobox").first();
    await firstField.click();
    await page.getByRole("option", { name: "Artist" }).click();

    const firstInput = page.getByPlaceholder("Search the catalog").first();
    await firstInput.fill("Juana Molina");

    // Wait for the first request to settle.
    await expect.poll(() => queryHits).toBeGreaterThan(0);

    // Add a second row, set field to Label and value to Sonamos.
    await page.getByRole("button", { name: "Add row" }).click();

    const secondInput = page.getByPlaceholder("Search the catalog").nth(1);
    // The new row's field defaults to "artist". Switch to Label.
    const fieldSelects = page.getByRole("combobox");
    // Operator + field + sort on row 0; operator + field on row 1.
    // Field selects are the ones rendering "All"/"Artist"/"Album"/"Label" text.
    // Use the input next to the second-row field — find the label combobox via
    // its current value text "Artist" (row 1's default).
    await fieldSelects.filter({ hasText: "Artist" }).last().click();
    await page.getByRole("option", { name: "Label" }).click();
    await secondInput.fill("Sonamos");

    await expect(page.getByText("DOGA")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Juana Molina")).toBeVisible();

    // Final issued q should contain both terms with AND.
    await expect
      .poll(() => lastQ ?? "")
      .toMatch(/artist:Juana Molina/);
    await expect.poll(() => lastQ ?? "").toMatch(/AND/);
    await expect.poll(() => lastQ ?? "").toMatch(/label:Sonamos/);
  });
});
