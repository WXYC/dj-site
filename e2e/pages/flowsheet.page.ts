import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Flowsheet (/dashboard/flowsheet)
 *
 * Covers search, entry list, Go Live controls, and inline editing.
 * All flowsheet-specific locators use data-testid attributes from
 * the test/flowsheet-e2e-testids branch.
 */
export class FlowsheetPage {
  readonly page: Page;
  private entriesResponsePromise: Promise<unknown> | null = null;

  // Smart-entry composer (v2)
  readonly searchForm: Locator;
  readonly composer: Locator;
  readonly submitButton: Locator;
  readonly searchResults: Locator;

  // Special entry buttons
  readonly talksetButton: Locator;
  readonly breakpointButton: Locator;

  // Go Live controls
  readonly goLiveButton: Locator;
  readonly liveStatus: Locator;

  // Toast notifications (sonner)
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // Smart-entry composer (v2): a single continuous input.
    this.searchForm = page.locator('[data-testid="flowsheet-smart-entry"]');
    this.composer = page.locator('[data-testid="flowsheet-composer"]');
    this.submitButton = page.getByRole("button", { name: "Play now" });
    this.searchResults = page.locator(
      '[data-testid="flowsheet-search-results"]'
    );

    // Special entries
    this.talksetButton = page.locator(
      '[data-testid="flowsheet-talkset-button"]'
    );
    this.breakpointButton = page.locator(
      '[data-testid="flowsheet-breakpoint-button"]'
    );

    // Live controls
    this.goLiveButton = page.locator(
      '[data-testid="flowsheet-go-live-button"]'
    );
    this.liveStatus = page.locator('[data-testid="flowsheet-live-status"]');

    // Toasts
    this.successToast = page.locator(
      '[data-sonner-toast][data-type="success"]'
    );
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  }

  // --- Navigation ---

  async goto(): Promise<void> {
    // Listen for the page-0 entries GET BEFORE navigating so we don't miss
    // it. Filter on "page=" to avoid resolving on whoIsLive or getNowPlaying
    // responses that share the /flowsheet/ prefix.
    this.entriesResponsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/flowsheet/") &&
        resp.url().includes("page=") &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 30000 }
    );
    await this.page.goto("/dashboard/flowsheet");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForEntriesLoaded(): Promise<void> {
    // Wait for the Go Live button to be visible (page has rendered)
    await this.goLiveButton.waitFor({ state: "visible", timeout: 10000 });
    // Wait for the getInfiniteEntries response captured before navigation.
    // This guarantees the RTK Query cache is populated before tests submit.
    if (this.entriesResponsePromise) {
      await this.entriesResponsePromise;
      this.entriesResponsePromise = null;
    }
  }

  // --- Go Live / Leave ---

  async goLive(): Promise<void> {
    // Wait for the button to be enabled and not loading
    await expect(this.goLiveButton).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(300); // Let prior mutations settle

    // Re-check status after the settle window. The whoIsLive query may
    // have resolved since the caller checked, flipping the component's
    // live state to true. Clicking while live would toggle us OFF air
    // (the button dispatches leaveShow instead of joinShow).
    const alreadyLive = (await this.liveStatus.textContent())?.includes(
      "On Air"
    );

    if (!alreadyLive) {
      // Listen for the mutation response BEFORE clicking so we don't miss
      // a fast reply. Without this, slow CI runners can fail: the optimistic
      // cache update fires synchronously, but React may not flush the
      // re-render before Playwright's assertion polls, or the backend may
      // reject and the optimistic patch rolls back.
      const mutationResponse = this.page.waitForResponse(
        (resp) =>
          resp.url().includes("/flowsheet/") &&
          resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await this.goLiveButton.click();
      await mutationResponse;
      await expect(this.liveStatus).toContainText("On Air", {
        timeout: 10000,
      });
    }

    // Wait for search inputs to become enabled (live state propagates)
    await expect(this.composer).toBeEnabled({ timeout: 5000 });
    // Reload and wait for the flowsheet API to respond with data, confirming
    // the entry list will render. The infinite query skips until the session
    // rehydrates, so we wait for the actual network response.
    const responsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes("/flowsheet/") && resp.status() === 200,
      { timeout: 20000 }
    );
    await this.page.reload();
    await responsePromise;
    // Wait for the page to be fully interactive after reload
    await expect(this.composer).toBeEnabled({ timeout: 10000 });
  }

  async leave(): Promise<void> {
    await expect(this.goLiveButton).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(300);
    const mutationResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/flowsheet/") &&
        resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await this.goLiveButton.click();
    await mutationResponse;
    await expect(this.liveStatus).toContainText("Off Air", { timeout: 10000 });
  }

  async ensureOffAir(): Promise<void> {
    try {
      const statusText = await this.liveStatus.textContent({ timeout: 3000 });
      if (statusText?.includes("On Air")) {
        await this.leave();
      }
    } catch {
      // Page may have navigated away or component not visible
    }
  }

  /**
   * Fast happy-path version of `goLive` for tests that don't care whether
   * the DJ was already On Air. Mirrors `ensureOffAir`.
   */
  async ensureLive(): Promise<void> {
    try {
      const statusText = await this.liveStatus.textContent({ timeout: 3000 });
      if (statusText?.includes("On Air")) return;
    } catch {
      // Status element not rendered yet — fall through to goLive
    }
    await this.goLive();
  }

  async expectLive(): Promise<void> {
    await expect(this.liveStatus).toContainText("On Air");
  }

  async expectOffAir(): Promise<void> {
    await expect(this.liveStatus).toContainText("Off Air");
  }

  // --- Adding entries ---

  /**
   * Compose a smart-entry sentence from the four fields and type it into the
   * single composer: "Song by Artist on Album via Label" (omitting empties).
   */
  buildSentence(data: {
    song: string;
    artist: string;
    album?: string;
    label?: string;
  }): string {
    return [
      data.song,
      data.artist && `by ${data.artist}`,
      data.album && `on ${data.album}`,
      data.label && `via ${data.label}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  async fillSearchForm(data: {
    song: string;
    artist: string;
    album?: string;
    label?: string;
  }): Promise<void> {
    await this.composer.click(); // focus opens the search
    await this.composer.fill(this.buildSentence(data));
    // Let the parse + debounced Redux sync catch up before submission.
    await this.page.waitForTimeout(300);
  }

  async submitViaButton(): Promise<void> {
    // Click the Play button (requestSubmit → form onSubmit → play).
    await this.submitButton.click();
  }

  async submitViaEnter(): Promise<void> {
    // Enter in the composer commits (play) when no result is highlighted.
    await this.composer.press("Enter");
  }

  async addTrack(
    data: { song: string; artist: string; album?: string; label?: string },
    method: "button" | "enter" = "button"
  ): Promise<void> {
    await this.fillSearchForm(data);
    // Register response listener BEFORE submitting so we don't miss the POST
    // if it completes while we're waiting for the form to clear. Timeout is
    // generous (30s) because parallel-worker contention on the shared E2E
    // backend can stretch a single POST end-to-end well past 15s — the
    // previous 15s value was the masked failure mode that the form-clear
    // race used to hide (see #570 diagnosis).
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/flowsheet") && r.request().method() === "POST" && r.status() < 300,
      { timeout: 30000 }
    );
    if (method === "button") {
      await this.submitViaButton();
    } else {
      await this.submitViaEnter();
    }
    // Wait for the server's response FIRST — that's the structural signal that
    // the mutation completed end-to-end. THEN assert the form cleared with a
    // short follow-up timeout: handleSubmit awaits addToFlowsheet, dispatches
    // resetSearch on success ([flowsheetHooks.ts:494-520]), and the input
    // value re-reads from Redux state — all synchronous after the response.
    // 2s is plenty for React's commit + DOM update.
    //
    // The previous shape raced the form-clear (10s timeout) against the
    // response itself, which is non-deterministic when the server is slow.
    // See WXYC/dj-site#570.
    await responsePromise;
    // The composer clears on a successful submit (the completion signal).
    await expect(this.composer).toHaveValue("", { timeout: 2000 });
  }

  // --- Entry locators ---

  getEntry(id: number): Locator {
    return this.page.locator(`[data-testid="flowsheet-entry-${id}"]`);
  }

  getRemoveButton(id: number): Locator {
    return this.page.locator(`[data-testid="flowsheet-remove-${id}"]`);
  }

  getAllEntries(): Locator {
    return this.page.locator('[data-testid^="flowsheet-entry-"]');
  }

  // --- Entry assertions ---

  async expectEntryCount(count: number, timeout = 10000): Promise<void> {
    await expect(this.getAllEntries()).toHaveCount(count, { timeout });
  }

  /**
   * Assert that at least one entry row contains the given text.
   */
  async expectEntryWithText(text: string, timeout = 10000): Promise<void> {
    await expect(
      this.page
        .locator('[data-testid^="flowsheet-entry-"]', { hasText: text })
        .first()
    ).toBeVisible({ timeout });
  }

  /**
   * Count how many entry rows contain the given text.
   */
  async countEntriesWithText(text: string): Promise<number> {
    return this.page
      .locator('[data-testid^="flowsheet-entry-"]', { hasText: text })
      .count();
  }

  /**
   * Read the visible text content of all entries in DOM order (top to bottom).
   */
  async getEntryTexts(): Promise<string[]> {
    const entries = this.getAllEntries();
    const count = await entries.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      texts.push((await entries.nth(i).textContent()) ?? "");
    }
    return texts;
  }

  // --- Inline editing ---

  /**
   * Double-click a text field within an entry row to activate editing,
   * clear and type a new value, then click away to save.
   *
   * The FlowsheetEntryField component shows the field value as a Typography
   * element; double-clicking it switches to an <input type="text">.
   */
  async editEntryField(
    entryId: number,
    currentValue: string,
    newValue: string
  ): Promise<void> {
    const entry = this.getEntry(entryId);
    // Double-click the text to activate editing
    await entry.locator(`text=${currentValue}`).first().dblclick();
    // The input appears inside the entry row
    const input = entry.locator('input[type="text"]').first();
    await input.fill(newValue);
    // Click the page header to trigger ClickAwayListener and save
    await this.page.locator("h2").first().click();
  }
}
