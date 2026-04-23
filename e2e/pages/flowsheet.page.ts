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

  // Search form
  readonly searchForm: Locator;
  readonly songInput: Locator;
  readonly artistInput: Locator;
  readonly albumInput: Locator;
  readonly labelInput: Locator;
  readonly submitButton: Locator;
  readonly searchResults: Locator;
  readonly newEntryPreview: Locator;

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

    // Search
    this.searchForm = page.locator('[data-testid="flowsheet-search-form"]');
    this.songInput = page.locator('[data-testid="flowsheet-search-song"]');
    this.artistInput = page.locator('[data-testid="flowsheet-search-artist"]');
    this.albumInput = page.locator('[data-testid="flowsheet-search-album"]');
    this.labelInput = page.locator('[data-testid="flowsheet-search-label"]');
    this.submitButton = page.locator('[data-testid="flowsheet-search-submit"]');
    this.searchResults = page.locator(
      '[data-testid="flowsheet-search-results"]'
    );
    this.newEntryPreview = page.locator(
      '[data-testid="flowsheet-new-entry-preview"]'
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
    await this.page.goto("/dashboard/flowsheet");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForEntriesLoaded(): Promise<void> {
    // Wait for the Go Live button to be visible (page has rendered)
    await this.goLiveButton.waitFor({ state: "visible", timeout: 10000 });
    // Brief pause for RTK Query to settle initial fetches
    await this.page.waitForTimeout(500);
  }

  // --- Go Live / Leave ---

  async goLive(): Promise<void> {
    // Wait for the button to be enabled and not loading
    await expect(this.goLiveButton).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(300); // Let prior mutations settle
    await this.goLiveButton.click();
    await expect(this.liveStatus).toContainText("On Air", { timeout: 10000 });
    // Wait for search inputs to become enabled (live state propagates)
    await expect(this.songInput).toBeEnabled({ timeout: 5000 });
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
    await expect(this.songInput).toBeEnabled({ timeout: 10000 });
  }

  async leave(): Promise<void> {
    await expect(this.goLiveButton).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(300);
    await this.goLiveButton.click();
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

  async expectLive(): Promise<void> {
    await expect(this.liveStatus).toContainText("On Air");
  }

  async expectOffAir(): Promise<void> {
    await expect(this.liveStatus).toContainText("Off Air");
  }

  // --- Adding entries ---

  async fillSearchForm(data: {
    song: string;
    artist: string;
    album?: string;
    label?: string;
  }): Promise<void> {
    // Click and focus the song input to open search (searchOpen = true on focus)
    await this.songInput.click();
    await this.songInput.fill(data.song);
    await this.artistInput.fill(data.artist);
    if (data.album) await this.albumInput.fill(data.album);
    if (data.label) await this.labelInput.fill(data.label);
    // Ensure Redux state has caught up before submission
    await this.page.waitForTimeout(100);
  }

  async submitViaButton(): Promise<void> {
    // Click the pink play/submit button.
    // Its onClick checks searchOpen: if true, calls form.requestSubmit();
    // if false, just focuses the first input. Search should be open after
    // fillSearchForm focused the song input.
    await this.submitButton.click();
  }

  async submitViaEnter(): Promise<void> {
    // Press Enter on the song input to trigger the form's onSubmit
    await this.songInput.press("Enter");
  }

  async addTrack(
    data: { song: string; artist: string; album?: string; label?: string },
    method: "button" | "enter" = "button"
  ): Promise<void> {
    await this.fillSearchForm(data);
    // Register response listener BEFORE submitting so we don't miss the POST
    // if it completes while we're waiting for the form to clear.
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/flowsheet") && r.request().method() === "POST" && r.status() < 300,
      { timeout: 15000 }
    );
    if (method === "button") {
      await this.submitViaButton();
    } else {
      await this.submitViaEnter();
    }
    // Wait for the form to clear — handleSubmit dispatches addToFlowsheet()
    // then immediately resets the search form, so this confirms the mutation
    // was initiated (though not necessarily that the response has arrived).
    await expect(this.songInput).toHaveValue("", { timeout: 10000 });
    // Wait for the POST response to confirm the entry is persisted on the server.
    await responsePromise;
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
