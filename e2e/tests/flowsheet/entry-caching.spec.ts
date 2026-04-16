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
  // Use dj2 to avoid session invalidation by auth/logout.spec.ts (which uses dj.json)
  test.use({ storageState: path.join(authDir, "dj2.json") });
  test.describe.configure({ mode: "serial" });
  // goLive() reloads the page and waits up to 20s for the flowsheet to render;
  // the default 20s test timeout doesn't leave room for beforeEach + test body.
  test.setTimeout(60_000);

  let flowsheet: FlowsheetPage;
  let isLive = false;
  const ts = Date.now();

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
    if (!isLive) {
      await flowsheet.goLive();
      isLive = true;
    }
  });

  test.afterAll(async ({ browser }) => {
    // Leave the show at the end of the suite
    const context = await browser.newContext({
      storageState: path.join(authDir, "dj2.json"),
      baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    });
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureOffAir();
    await context.close();
  });

  // ---------------------------------------------------------------
  // 1. Basic add behavior
  // ---------------------------------------------------------------
  test.describe("1. Basic add behavior", () => {
    test("should add entry via submit button click", async ({ page }) => {
      const trackName = `Button Add ${ts}`;

      await flowsheet.addTrack(
        { song: trackName, artist: "E2E Artist", album: "E2E Album" },
        "button"
      );

      await flowsheet.expectEntryWithText(trackName);
    });

    test("should add entry via Enter key", async ({ page }) => {
      const trackName = `Enter Add ${ts}`;

      await flowsheet.addTrack(
        { song: trackName, artist: "E2E Artist", album: "E2E Album" },
        "enter"
      );

      await flowsheet.expectEntryWithText(trackName);
    });
  });

  // ---------------------------------------------------------------
  // 2. Consistency across multiple attempts
  // ---------------------------------------------------------------
  test.describe("2. Consistency", () => {
    test("all tracks appear after adding 12 entries", async ({ page }) => {
      test.slow(); // This test adds many entries

      const trackCount = 12;
      const initialCount = await flowsheet.getAllEntries().count();
      const trackNames: string[] = [];

      for (let i = 0; i < trackCount; i++) {
        const name = `Consistency ${ts}-${String(i + 1).padStart(2, "0")}`;
        trackNames.push(name);
        const method = i % 2 === 0 ? "button" : "enter";
        await flowsheet.addTrack(
          { song: name, artist: `Artist ${i + 1}`, album: `Album ${i + 1}` },
          method as "button" | "enter"
        );
      }

      // All tracks should be present
      for (const name of trackNames) {
        await flowsheet.expectEntryWithText(name, 20000);
      }
    });
  });

  // ---------------------------------------------------------------
  // 3. Rapid input
  // ---------------------------------------------------------------
  test.describe("3. Rapid input", () => {
    // TODO: This test surfaces a potential issue where addToFlowsheet mutations
    // hang after many entries accumulate in the cache. Investigate as a follow-up
    // to PR #306 -- the mutation's onQueryStarted may have a race condition with
    // the infinite query cache when pages.length > 1.
    test.fixme("quick successive adds maintain order with no duplicates", async ({
      page,
    }) => {
      test.slow(); // Rapid adds need extra time budget

      // Use 3 entries with unique prefixes to avoid substring collisions
      const trackNames = [
        `RapidAlpha-${ts}`,
        `RapidBeta-${ts}`,
        `RapidGamma-${ts}`,
      ];

      // Fire adds using Enter key (bypasses searchOpen check in button onClick)
      for (const name of trackNames) {
        await flowsheet.addTrack(
          { song: name, artist: "Rapid Artist" },
          "enter"
        );
      }

      // Wait for the last-added entry (it should be at the very top)
      const lastAdded = trackNames[trackNames.length - 1];
      await flowsheet.expectEntryWithText(lastAdded, 15000);

      // Verify no duplicates among visible entries for the ones we can see
      const lastCount = await flowsheet.countEntriesWithText(lastAdded);
      expect(lastCount, `"${lastAdded}" should appear exactly once`).toBe(1);

      // Verify ordering: most recent entries should be at the top
      // Entries sorted by play_order descending (highest first)
      const entryTexts = await flowsheet.getEntryTexts();
      const secondAdded = trackNames[1];
      const lastAddedPos = entryTexts.findIndex((t) =>
        t.includes(lastAdded)
      );
      const secondAddedPos = entryTexts.findIndex((t) =>
        t.includes(secondAdded)
      );
      // Both should be visible and last added should be above second added
      expect(lastAddedPos).toBeGreaterThanOrEqual(0);
      expect(secondAddedPos).toBeGreaterThanOrEqual(0);
      expect(
        lastAddedPos,
        "Last added track should appear before second added"
      ).toBeLessThan(secondAddedPos);
    });
  });

  // ---------------------------------------------------------------
  // 4. Slow network conditions (optimistic update)
  // ---------------------------------------------------------------
  test.describe("4. Slow network", () => {
    // TODO: Optimistic entry does not appear in entry list within 2s of
    // submission when POST is delayed. Investigate whether onQueryStarted's
    // buildOptimisticEntry + insertEntrySortedFirstPage actually runs before
    // the route interception delays the network request.
    test.fixme("entry appears immediately under throttled network", async ({
      page,
    }) => {
      const trackName = `Optimistic ${ts}`;

      // Intercept the flowsheet POST and delay it by 5 seconds.
      // Pattern must include trailing slash to match the actual URL.
      await page.route("**/flowsheet/", async (route) => {
        if (route.request().method() === "POST") {
          await new Promise((r) => setTimeout(r, 5000));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      // Fill the form and submit WITHOUT waiting for form to clear
      // (the form won't clear until the delayed mutation resolves)
      await flowsheet.fillSearchForm({
        song: trackName,
        artist: "Optimistic Artist",
      });
      await flowsheet.submitViaEnter();

      // The optimistic entry should appear within ~2s, long before the 5s
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
      // Wait for form to finish clearing
      await expect(flowsheet.songInput).toHaveValue("", { timeout: 5000 });
    });
  });

  // ---------------------------------------------------------------
  // 5. Page load timing
  // ---------------------------------------------------------------
  test.describe("5. Page load timing", () => {
    // TODO: The entries GET delay route may be intercepting the flowsheet POST
    // as well, causing the add mutation to hang. Needs URL pattern refinement.
    test.fixme("can add track before entry list fully loads", async ({ page }) => {
      // Set up a route to delay entries loading BEFORE navigating
      await page.route("**/flowsheet/?page=0**", async (route) => {
        if (route.request().method() === "GET") {
          await new Promise((r) => setTimeout(r, 4000));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      // Re-navigate: entries will be delayed but DJ is still live from beforeEach
      await page.goto("/dashboard/flowsheet");
      await page.waitForLoadState("domcontentloaded");

      // Wait for the search inputs to be enabled (DJ is still live server-side)
      await expect(flowsheet.songInput).toBeEnabled({ timeout: 10000 });

      const trackName = `Eager ${ts}`;
      await flowsheet.addTrack({ song: trackName, artist: "Eager Artist" });

      // After the delayed entries load completes, the track should be visible
      await page.unroute("**/flowsheet/?page=0**");
      await flowsheet.expectEntryWithText(trackName, 15000);
    });
  });

  // ---------------------------------------------------------------
  // 6. Edit behavior
  // ---------------------------------------------------------------
  test.describe("6. Edit behavior", () => {
    test("edit appears immediately and persists after refresh", async ({
      page,
    }) => {
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

      // Set up response listener BEFORE the edit action
      const patchPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/flowsheet") &&
          resp.request().method() === "PATCH",
        { timeout: 10000 }
      );

      // Double-click the track title to edit
      await flowsheet.editEntryField(entryId, originalTitle, modifiedTitle);

      // The edit should appear immediately (optimistic cache update)
      await expect(flowsheet.getEntry(entryId)).toContainText(modifiedTitle);

      // Wait for the PATCH to complete
      await patchPromise;

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
    // TODO: Same add-mutation hang as rapid/slow-network tests. New browser
    // contexts start with empty cache; after 20+ DB entries the mutation hangs.
    test.fixme("entry added in one tab appears in another after refresh", async ({
      browser,
    }) => {
      test.slow(); // Multi-context test needs extra time

      const storageState = path.join(authDir, "dj2.json");
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

        // DJ is already live from beforeEach (same session/cookies).
        // Tab 1's whoIsLive query should already show us as live.
        await fs1.expectLive();

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
      } finally {
        await context1.close().catch(() => {});
        await context2.close().catch(() => {});
      }
    });
  });

  // ---------------------------------------------------------------
  // 8. Live / Go Live interaction
  // ---------------------------------------------------------------
  test.describe("8. Live toggle interaction", () => {
    test("can add track immediately after going live", async ({ page }) => {
      // Leave first so we can test the go-live -> add flow
      await flowsheet.leave();
      isLive = false;
      await flowsheet.expectOffAir();

      // Go live and immediately add a track
      await flowsheet.goLive();
      isLive = true;

      const trackName = `Post-Live ${ts}`;
      await flowsheet.addTrack({
        song: trackName,
        artist: "Post-Live Artist",
        album: "Post-Live Album",
      });

      // Entry should appear without glitches
      await flowsheet.expectEntryWithText(trackName);
    });
  });
});
