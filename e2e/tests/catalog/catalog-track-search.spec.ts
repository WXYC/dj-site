import path from "path";
import {
  wxycCanonicalArtistNames,
  wxycExampleSearchResults,
} from "@wxyc/shared/test-utils";
import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";

const authDir = path.join(__dirname, "../../.auth");

const CONFIELD_ROW = {
  id: 7373,
  album_title: "Confield",
  artist_name: "Autechre",
  code_artist_number: 7,
  code_letters: "EL",
  code_number: 1,
  format_name: "CD",
  genre_name: "Electronic",
  label: "Warp Records",
  plays: 4,
  add_date: "2001-04-09",
  matched_via: [
    {
      title: "vi scose poise",
      artist_credit: "Autechre",
      source: "discogs_release" as const,
    },
  ],
};

const COMP_TRACK_TITLE = "Magalenha";
const COMP_ROW = {
  ...wxycExampleSearchResults.variousArtistsComp,
  matched_via: [
    {
      title: COMP_TRACK_TITLE,
      artist_credit: "Sérgio Mendes",
      source: "discogs_release" as const,
    },
  ],
};

async function mockCatalogQuery(
  page: import("@playwright/test").Page,
  row: Record<string, unknown>,
): Promise<void> {
  await page.route("**/library/query**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [row],
        total: 1,
        page: 0,
        totalPages: 1,
      }),
    });
  });
}

test.describe("Catalog track search — matched_via chip rendering", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });

  test("'vi scose poise' surfaces Confield by Autechre with a matched-via chip", async ({
    page,
  }) => {
    // Autechre is in the WXYC canonical artist pool — anchors the choice of
    // an electronic-leaning example over a mainstream act.
    expect(wxycCanonicalArtistNames).toContain("Autechre");

    await mockCatalogQuery(page, CONFIELD_ROW);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoCatalog();
    await dashboard.waitForPageLoad();

    const searchInput = page.getByPlaceholder("Search the catalog").first();
    await searchInput.fill("vi scose poise");

    await expect(page.getByText("Confield")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Autechre").first()).toBeVisible();

    await expect(
      page.getByLabel(/matched on track: vi scose poise/i).first(),
    ).toBeVisible();
  });

  test("a comp track query surfaces the V/A release with a matched-via chip", async ({
    page,
  }) => {
    await mockCatalogQuery(page, COMP_ROW);

    const dashboard = new DashboardPage(page);
    await dashboard.gotoCatalog();
    await dashboard.waitForPageLoad();

    const searchInput = page.getByPlaceholder("Search the catalog").first();
    await searchInput.fill(COMP_TRACK_TITLE);

    await expect(
      page.getByText(wxycExampleSearchResults.variousArtistsComp.album_title),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Various Artists").first()).toBeVisible();

    await expect(
      page
        .getByLabel(new RegExp(`matched on track: ${COMP_TRACK_TITLE}`, "i"))
        .first(),
    ).toBeVisible();
  });
});
