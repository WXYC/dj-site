import { test, expect } from "../../fixtures/auth.fixture";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

/**
 * Regression smoke test for the 2026-06-21 flowsheet crash.
 *
 * A DJ reported the site white-screening as they typed into the artist field
 * while entering a playcut — notably for "The O'Jays", and generally on
 * apostrophes and spaces ("it also triggered whenever i typed something with a
 * space", "i couldn't get past The"). The Modern app's only error boundary is
 * `app/global-error.tsx`, so any uncaught render throw in the live search path
 * replaces the entire document with its `<h2>Something went wrong</h2>` — which
 * to the DJ reads as "the website crashes".
 *
 * This test drives the real artist-field search path in headless Chromium
 * against the live E2E backend, typing the exact problem inputs one key at a
 * time so every intermediate query state fires its debounced searches — the
 * precise "crashes as I type a few characters" condition. It asserts the global
 * error boundary never appears, the search UI stays mounted and interactive,
 * and no null/undefined dereference reaches the console.
 *
 * Caveat: this is a smoke test, not a deterministic reproduction. The original
 * crash is data-dependent (the triggering row must exist in the backend the DJ
 * was hitting), and dj-site's result conversions coerce missing fields, so this
 * can't *force* the failure. It pins the live path so a regression on these
 * inputs — the ones a real DJ hit — is caught in CI.
 *
 * The search form is live-only, so this mirrors library-search-proxy.spec.ts:
 * serial mode, go live once, ensure off-air in afterAll, and the musicDirector
 * session (kept off dj/dj2, which auth and entry-caching specs own).
 */
test.describe("Flowsheet artist search — crash smoke", () => {
  test.use({ storageState: path.join(authDir, "musicDirector.json") });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let flowsheet: FlowsheetPage;
  let isLive = false;

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
    const context = await browser.newContext({
      storageState: path.join(authDir, "musicDirector.json"),
      baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    });
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureOffAir();
    await context.close();
  });

  // The reported triggers were an apostrophe ("The O'Jays"), a space, and the
  // bare prefix "The". The extra names mix spaces, diacritics, and an ampersand
  // — all from the WXYC example catalog — to exercise the same lexical edges
  // without leaning on mainstream acts.
  const PROBLEM_ARTISTS = [
    "The O'Jays", // the exact reported case: apostrophe + space
    "The ", // "couldn't get past The" — the space crosses the 3-char search threshold
    "Hermanos Gutiérrez", // space + diacritics
    "Duke Ellington & John Coltrane", // multiple spaces + ampersand
  ];

  for (const artist of PROBLEM_ARTISTS) {
    test(`typing ${JSON.stringify(artist)} char-by-char never white-screens`, async ({
      page,
    }) => {
      // The boundary that a render throw would surface (its own document root).
      const crashBoundary = page.getByRole("heading", {
        name: "Something went wrong",
      });

      // Capture the crash-class signal even if the boundary swallows the throw:
      // React logs boundary-caught errors to console.error in prod builds, and
      // any genuinely uncaught throw lands as a pageerror.
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      // Focus the artist field (opens search) and type one key at a time so the
      // debounced catalog/LML/rotation/bin/suggest searches fire on every
      // intermediate state ("t", "th", "the", "the ", "the o", "the o'", …).
      await expect(flowsheet.artistInput).toBeEnabled({ timeout: 10_000 });
      await flowsheet.artistInput.click();
      await flowsheet.artistInput.pressSequentially(artist, { delay: 80 });

      // Let the longest debounce (LML, 350 ms) plus its search and re-render
      // settle, leaving a beat for any intermediate-state throw to surface.
      await page.waitForTimeout(800);

      // 1) The error boundary must never have replaced the page.
      await expect(crashBoundary).toHaveCount(0);
      // 2) The search input is still mounted and holds exactly what we typed —
      //    proof the React tree didn't unmount into the boundary mid-type.
      await expect(flowsheet.artistInput).toBeVisible();
      await expect(flowsheet.artistInput).toHaveValue(artist);

      // 3) No null/undefined dereference — the specific crash class — reached
      //    the console or window during the type.
      const nullDerefs = errors.filter((t) =>
        /Cannot read propert(?:y|ies) of (?:null|undefined)/i.test(t)
      );
      expect(
        nullDerefs,
        `null-dereference error(s) during artist type "${artist}":\n${nullDerefs.join("\n")}`
      ).toEqual([]);
    });
  }
});
