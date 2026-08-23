import type { Page } from "@playwright/test";

/**
 * Matches the legacy card-catalog search request — `useSearchCatalogQuery` →
 * `GET <base>/library/?...`.
 *
 * The `/proxy/` carve-out is load-bearing: the LML proxy lives under
 * `/proxy/library/*`, so a predicate without it would swallow both and make a
 * catalog stub silently intercept LML traffic too.
 */
const isCatalogSearch = (url: URL): boolean =>
  url.pathname.endsWith("/library/") && !url.pathname.includes("/proxy/");

/**
 * Serve `rows` for the card-catalog search, leaving every other request alone.
 *
 * Non-GET falls through: the same path serves catalog writes, and a spec that
 * stubs a search must not also swallow an add.
 *
 * Register before the navigation that triggers the search. Interception fails
 * open — if the route stops matching, the spec does not error, it silently
 * falls through to the seeded database and asserts against whatever rows that
 * happens to hold.
 */
export async function stubCatalogSearch(
  page: Page,
  rows: readonly unknown[]
): Promise<void> {
  await page.route(isCatalogSearch, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    });
  });
}
