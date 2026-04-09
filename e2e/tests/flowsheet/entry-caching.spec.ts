import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Flowsheet Entry Caching E2E Tests
 *
 * Automates the manual verification checklist from PR #306:
 * https://github.com/WXYC/dj-site/pull/306#issuecomment-4189766147
 *
 * All tests require a running Backend-Service, Auth, PostgreSQL, and dj-site.
 * Uses the pre-authenticated DJ session from auth.setup.ts.
 */
test.describe("Flowsheet Entry Caching", () => {
  test.use({ storageState: path.join(authDir, "dj.json") });
  test.describe.configure({ mode: "serial" });

  let flowsheet: FlowsheetPage;
  const ts = Date.now();

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
  });

  test.afterEach(async ({ page }) => {
    const fs = new FlowsheetPage(page);
    await fs.ensureOffAir();
  });

  // ---------------------------------------------------------------
  // 1. Basic add behavior
  // ---------------------------------------------------------------
  test.describe("1. Basic add behavior", () => {
    test("should add entry via submit button click", async ({ page }) => {
      await flowsheet.goLive();

      const initialCount = await flowsheet.getAllEntries().count();
      const trackName = `Button Add ${ts}`;

      await flowsheet.addTrack(
        { song: trackName, artist: "E2E Artist", album: "E2E Album" },
        "button"
      );

      await flowsheet.expectEntryWithText(trackName);
      await flowsheet.expectEntryCount(initialCount + 1);
    });

    test("should add entry via Enter key", async ({ page }) => {
      await flowsheet.goLive();

      const initialCount = await flowsheet.getAllEntries().count();
      const trackName = `Enter Add ${ts}`;

      await flowsheet.addTrack(
        { song: trackName, artist: "E2E Artist", album: "E2E Album" },
        "enter"
      );

      await flowsheet.expectEntryWithText(trackName);
      await flowsheet.expectEntryCount(initialCount + 1);
    });
  });

  // ---------------------------------------------------------------
  // 2. Consistency across multiple attempts
  // ---------------------------------------------------------------
  test.describe("2. Consistency", () => {
    test("all tracks appear after adding 12 entries", async ({ page }) => {
      test.slow(); // This test adds many entries
      await flowsheet.goLive();

      const trackCount = 12;
      const initialCount = await flowsheet.getAllEntries().count();
      const trackNames: string[] = [];

      for (let i = 0; i < trackCount; i++) {
        const name = `Consistency ${ts}-${i + 1}`;
        trackNames.push(name);
        const method = i % 2 === 0 ? "button" : "enter";
        await flowsheet.addTrack(
          { song: name, artist: `Artist ${i + 1}`, album: `Album ${i + 1}` },
          method as "button" | "enter"
        );
      }

      // All tracks should be present
      await flowsheet.expectEntryCount(initialCount + trackCount, 20000);
      for (const name of trackNames) {
        await flowsheet.expectEntryWithText(name);
      }
    });
  });

  // ---------------------------------------------------------------
  // 3. Rapid input
  // ---------------------------------------------------------------
  test.describe("3. Rapid input", () => {
    test("quick successive adds maintain order with no duplicates", async ({
      page,
    }) => {
      await flowsheet.goLive();

      const trackNames = [
        `Rapid-A ${ts}`,
        `Rapid-B ${ts}`,
        `Rapid-C ${ts}`,
        `Rapid-D ${ts}`,
        `Rapid-E ${ts}`,
      ];
      const initialCount = await flowsheet.getAllEntries().count();

      // Fire adds as fast as possible
      for (const name of trackNames) {
        await flowsheet.addTrack({ song: name, artist: "Rapid Artist" });
      }

      // Wait for all entries to settle
      await flowsheet.expectEntryCount(
        initialCount + trackNames.length,
        15000
      );

      // Each track should appear exactly once (no duplicates)
      for (const name of trackNames) {
        const count = await flowsheet.countEntriesWithText(name);
        expect(count, `"${name}" should appear exactly once`).toBe(1);
      }

      // Verify order: newest (last added) should be at top of the list
      // Entries are sorted by play_order descending
      const entryTexts = await flowsheet.getEntryTexts();
      const lastAdded = trackNames[trackNames.length - 1];
      const firstAdded = trackNames[0];
      const lastAddedPos = entryTexts.findIndex((t) => t.includes(lastAdded));
      const firstAddedPos = entryTexts.findIndex((t) => t.includes(firstAdded));
      expect(
        lastAddedPos,
        "Last added track should appear before first added"
      ).toBeLessThan(firstAddedPos);
    });
  });

  // ---------------------------------------------------------------
  // 4. Slow network conditions (optimistic update)
  // ---------------------------------------------------------------
  test.describe("4. Slow network", () => {
    test("entry appears immediately under throttled network", async ({
      page,
    }) => {
      await flowsheet.goLive();

      const trackName = `Optimistic ${ts}`;

      // Intercept the flowsheet POST and delay it by 5 seconds
      await page.route("**/flowsheet/", async (route) => {
        if (route.request().method() === "POST") {
          await new Promise((r) => setTimeout(r, 5000));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      await flowsheet.addTrack({ song: trackName, artist: "Optimistic Artist" });

      // The optimistic entry should appear within ~1.5s, long before the 5s
      // network delay resolves. buildOptimisticEntry() inserts a temp row into
      // the RTK Query cache immediately in onQueryStarted, before awaiting
      // queryFulfilled.
      // NOTE: If this flakes in CI (slower hardware), increase timeout to 2500ms.
      await flowsheet.expectEntryWithText(trackName, 2000);

      // Wait for the delayed response to complete and verify the entry is
      // still there (temp ID replaced with server ID, no flicker)
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/flowsheet") &&
          resp.request().method() === "POST",
        { timeout: 10000 }
      );
      await flowsheet.expectEntryWithText(trackName);

      await page.unroute("**/flowsheet/");
    });
  });

  // ---------------------------------------------------------------
  // 5. Page load timing
  // ---------------------------------------------------------------
  test.describe("5. Page load timing", () => {
    test("can add track before entry list fully loads", async ({ page }) => {
      // Delay the GET entries response so the page is in loading state
      await page.route("**/flowsheet/?page=0**", async (route) => {
        if (route.request().method() === "GET") {
          await new Promise((r) => setTimeout(r, 4000));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      const fs = new FlowsheetPage(page);
      await fs.goto();

      // Go live (the who-is-live query resolves independently of entries)
      await fs.goLive();

      const trackName = `Eager ${ts}`;
      await fs.addTrack({ song: trackName, artist: "Eager Artist" });

      // After the delayed entries load completes, the track should be visible
      await page.unroute("**/flowsheet/?page=0**");
      await fs.expectEntryWithText(trackName, 15000);
    });
  });

  // ---------------------------------------------------------------
  // 6. Edit behavior
  // ---------------------------------------------------------------
  test.describe("6. Edit behavior", () => {
    test("edit appears immediately and persists after refresh", async ({
      page,
    }) => {
      await flowsheet.goLive();

      const originalTitle = `Editable ${ts}`;
      const modifiedTitle = `Modified ${ts}`;

      // Add a track and capture its server-assigned ID from the POST response
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/flowsheet") &&
          resp.request().method() === "POST"
      );
      await flowsheet.addTrack({
        song: originalTitle,
        artist: "Edit Artist",
        album: "Edit Album",
      });
      const response = await responsePromise;
      const newEntry = await response.json();
      const entryId = newEntry.id;

      // Verify the entry appeared
      await expect(flowsheet.getEntry(entryId)).toBeVisible();

      // Double-click the track title to edit
      await flowsheet.editEntryField(entryId, originalTitle, modifiedTitle);

      // The edit should appear immediately (optimistic cache update)
      await expect(flowsheet.getEntry(entryId)).toContainText(modifiedTitle);

      // Wait for the PATCH to complete
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/flowsheet") &&
          resp.request().method() === "PATCH",
        { timeout: 10000 }
      );

      // Refresh and verify the edit persisted
      await page.reload();
      await flowsheet.waitForEntriesLoaded();
      await expect(flowsheet.getEntry(entryId)).toContainText(modifiedTitle);
    });
  });

  // ---------------------------------------------------------------
  // 7. Multiple tabs
  // ---------------------------------------------------------------
  test.describe("7. Multiple tabs", () => {
    test("entry added in one tab appears in another after refresh", async ({
      browser,
    }) => {
      const storageState = path.join(authDir, "dj.json");
      const baseURL =
        process.env.E2E_BASE_URL || "http://localhost:3000";

      const context1 = await browser.newContext({ storageState, baseURL });
      const context2 = await browser.newContext({ storageState, baseURL });
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        const fs1 = new FlowsheetPage(page1);
        const fs2 = new FlowsheetPage(page2);

        // Both tabs navigate to flowsheet
        await fs1.goto();
        await fs2.goto();
        await fs1.waitForEntriesLoaded();
        await fs2.waitForEntriesLoaded();

        // Go live in tab 1
        await fs1.goLive();

        // Add a track in tab 1
        const trackName = `Cross Tab ${ts}`;
        await fs1.addTrack({ song: trackName, artist: "Cross Tab Artist" });

        // Tab 1 should show it immediately
        await fs1.expectEntryWithText(trackName);

        // Tab 2 reloads to pick up the change (RTK Query caches are per-context;
        // the 60s polling interval is too slow for a test)
        await page2.reload();
        await fs2.waitForEntriesLoaded();
        await fs2.expectEntryWithText(trackName, 10000);

        // Cleanup: leave show
        await fs1.ensureOffAir();
      } finally {
        await context1.close();
        await context2.close();
      }
    });
  });

  // ---------------------------------------------------------------
  // 8. Live / Go Live interaction
  // ---------------------------------------------------------------
  test.describe("8. Live toggle interaction", () => {
    test("can add track immediately after going live", async ({ page }) => {
      await flowsheet.expectOffAir();
      await flowsheet.goLive();

      // Immediately add a track
      const trackName = `Post-Live ${ts}`;
      await flowsheet.addTrack({
        song: trackName,
        artist: "Post-Live Artist",
        album: "Post-Live Album",
      });

      // Entry should appear without glitches
      await flowsheet.expectEntryWithText(trackName);

      // Leave and verify status
      await flowsheet.leave();
      await flowsheet.expectOffAir();
    });
  });
});
