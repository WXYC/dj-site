import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Both facts here are width-dependent, so they live in e2e rather than in the
 * jsdom suite: jsdom resolves no media queries, which makes every width read
 * as the narrowest one and hides the desktop layout entirely.
 */
test.describe("Admin Roster Layout", () => {
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let rosterPage: RosterPage;

  test.beforeEach(async ({ page }) => {
    rosterPage = new RosterPage(page);
    await new DashboardPage(page).gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("keeps the roster-wide actions on a line below the search and filters", async () => {
    const search = await rosterPage.searchInput.first().boundingBox();
    const addDj = await rosterPage.addDjButton.boundingBox();

    expect(search).not.toBeNull();
    expect(addDj).not.toBeNull();
    // Strictly below, not merely offset: sharing the line is the regression.
    expect(addDj!.y).toBeGreaterThanOrEqual(search!.y + search!.height);
  });

  test("bounds the roster to the viewport so it scrolls instead of clipping", async () => {
    // The dashboard's main column is a fixed 100dvh box with overflow:hidden,
    // so a roster that runs past the viewport is clipped away with no way to
    // reach it. The fix is a scroll pane, and what proves it is a pane that
    // ends inside the viewport — true whether or not the seeded roster
    // happens to be long enough to overflow.
    const pane = await rosterPage.rosterTable.evaluateHandle((table) => {
      let node = table.parentElement;
      while (node && getComputedStyle(node).overflowY !== "auto") {
        node = node.parentElement;
      }
      return node;
    });

    const bounds = await pane.evaluate((node: HTMLElement | null) =>
      node
        ? {
            bottom: node.getBoundingClientRect().bottom,
            viewport: window.innerHeight,
            scrollable: node.scrollHeight >= node.clientHeight,
          }
        : null
    );

    expect(bounds).not.toBeNull();
    expect(bounds!.scrollable).toBe(true);
    // Sub-pixel layout rounding, not a tolerance for overhang.
    expect(bounds!.bottom).toBeLessThanOrEqual(bounds!.viewport + 1);
  });
});
