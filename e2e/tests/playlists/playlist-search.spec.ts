import path from "path";
import type { Page } from "@playwright/test";
import type {
  PlaylistSearchResponse,
  PlaylistSearchResult,
} from "@wxyc/shared/dtos";
import { test, expect } from "../../fixtures/auth.fixture";

const authDir = path.join(__dirname, "../../.auth");

const MOCK_ROWS: PlaylistSearchResult[] = [
  {
    id: 5316943,
    play_date: "2026-09-08T23:42:51.752Z",
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    dj_name: "DJ Chowder",
    show_id: 1951321,
  },
  {
    id: 5316944,
    play_date: "2026-09-08T23:46:12.000Z",
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    record_label: "Drag City",
    dj_name: "DJ Chowder",
    show_id: 1951321,
  },
];

type SortRequest = { sort: string | null; order: string | null };

test.describe("Previous Sets sort control", () => {
  test.use({ storageState: path.join(authDir, "dj2.json") });
  test.setTimeout(60_000);

  /**
   * Records every search the page issues and answers with fixed rows.
   * Returns the record, which fills as the page navigates and re-sorts.
   */
  async function stubSearch(page: Page): Promise<SortRequest[]> {
    const recorded: SortRequest[] = [];

    await page.route("**/flowsheet/search**", async (route) => {
      const url = new URL(route.request().url());
      recorded.push({
        sort: url.searchParams.get("sort"),
        order: url.searchParams.get("order"),
      });
      const body: PlaylistSearchResponse = {
        results: MOCK_ROWS,
        total: MOCK_ROWS.length,
        page: 0,
        totalPages: 1,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    return recorded;
  }

  test("asks the archive for exactly the sort the chosen option names", async ({
    page,
  }) => {
    const recorded = await stubSearch(page);

    await page.goto("/dashboard/playlists");
    await page.waitForLoadState("domcontentloaded");

    const pickSort = async (choose: string) => {
      await page.getByRole("combobox", { name: "Sort by" }).click();
      await page.getByRole("option", { name: choose, exact: true }).click();
    };

    // The archive starts in November 2004, so the default listing must be
    // newest-first or today's plays sit thousands of pages down.
    await expect
      .poll(() => recorded.at(-1))
      .toEqual({ sort: "date", order: "desc" });

    await pickSort("Artist (A-Z)");
    await expect
      .poll(() => recorded.at(-1))
      .toEqual({ sort: "artist", order: "asc" });

    await pickSort("Date (Oldest)");
    await expect
      .poll(() => recorded.at(-1))
      .toEqual({ sort: "date", order: "asc" });

    await pickSort("Date (Newest)");
    await expect
      .poll(() => recorded.at(-1))
      .toEqual({ sort: "date", order: "desc" });
  });

  test("announces the active sort direction on the results table", async ({
    page,
  }) => {
    const recorded = await stubSearch(page);

    await page.goto("/dashboard/playlists");
    await page.waitForLoadState("domcontentloaded");

    const dateHeader = page.getByRole("columnheader", { name: "Date" });
    await expect(dateHeader).toHaveAttribute("aria-sort", "descending");

    // The click target is the label itself, not the padded cell around it.
    await dateHeader.getByText("Date", { exact: true }).click();
    await expect(dateHeader).toHaveAttribute("aria-sort", "ascending");
    await expect
      .poll(() => recorded.at(-1))
      .toEqual({ sort: "date", order: "asc" });
  });
});
