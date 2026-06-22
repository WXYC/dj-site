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
 * Scope + caveat: this is a smoke test of the NORMAL (non-rotation) artist
 * field — the path the DJ reported — not a deterministic reproduction. The
 * original crash is data-dependent (the triggering row must exist in the
 * backend the DJ was hitting) and dj-site's result conversions coerce missing
 * fields, so this can't *force* the failure. The rotation-mode null-artist
 * guards that ship alongside it are covered by their own unit tests
 * (RotationReleaseDropdown / RotationEntryFields / sortRotationReleases). This
 * pins the live normal-entry path so a regression on these inputs — the ones a
 * real DJ hit — is caught in CI.
 *
 * The search form is live-only, so this mirrors library-search-proxy.spec.ts:
 * serial mode, ensure-live per test, ensure off-air in afterAll, and the
 * musicDirector session (kept off dj/dj2, which auth and entry-caching specs
 * own). ensureLive (not a once-only goLive) self-heals if a sibling spec
 * sharing the musicDirector session flipped it off-air between tests.
 */
test.describe("Flowsheet artist search — crash smoke", () => {
  test.use({ storageState: path.join(authDir, "musicDirector.json") });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let flowsheet: FlowsheetPage;

  test.beforeEach(async ({ page }) => {
    flowsheet = new FlowsheetPage(page);
    await flowsheet.goto();
    await flowsheet.waitForEntriesLoaded();
    // ensureLive (not a once-only goLive flag): self-heals if a sibling spec
    // sharing the musicDirector session flipped it off-air between tests.
    await flowsheet.ensureLive();
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

      // Best-effort secondary crash signal — a console.error or uncaught
      // pageerror during the type. The primary guarantee is the boundary
      // assertion below; a prod build may not surface a boundary-caught throw
      // here, so this only ever adds signal, never removes it.
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

      // Settle the crash window after the last keystroke: the longest debounce
      // (LML, 350 ms) + its search round-trip against the local E2E backend +
      // the React commit. A white-screen, once mounted, persists — global-error
      // replaces the document and only reset() clears it — so a generous fixed
      // wait reliably surfaces any crash that lands in this window, and the
      // assertions below also auto-retry up to the 10 s expect timeout. (A
      // response-keyed wait was rejected: the search URLs overlap page-load
      // traffic like /library/rotation and the early /suggest prefix calls, so
      // it resolved on the wrong request; and the bin/rotation filter crash
      // path is client-side, with no response to await.)
      await page.waitForTimeout(1_500);

      // 1) Primary: the error boundary must never have replaced the page — a
      //    render throw mounts global-error.tsx's own document root.
      await expect(crashBoundary).toHaveCount(0);
      // 2) The search input is still mounted and interactive — proof the React
      //    tree didn't unmount into the boundary mid-type. (We don't assert the
      //    exact value: against the live backend a matched result can auto-fill
      //    the field, so the typed string isn't guaranteed to survive.)
      await expect(flowsheet.artistInput).toBeVisible();
      await expect(flowsheet.artistInput).toBeEnabled();

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
