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
    // The joinShow mutation invalidates the Flowsheet cache, but the infinite
    // query may still be initializing (it skips until user data loads). Reload
    // to ensure a clean fetch, then wait for the "started the set" entry text
    // which confirms the flowsheet list has rendered.
    await this.page.reload();
    await this.page.waitForLoadState("domcontentloaded");
    await expect(
      this.page.getByText("started the set").first()
    ).toBeVisible({ timeout: 20000 });
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
    if (method === "button") {
      await this.submitViaButton();
    } else {
      await this.submitViaEnter();
    }
    // Wait for the search form to reset (song input clears after resetSearch dispatch).
    // The handleSubmit in flowsheetHooks awaits addToFlowsheet() before clearing,
    // so this wait ensures the mutation has completed on the server.
    await expect(this.songInput).toHaveValue("", { timeout: 10000 });
    // RTK Query's infiniteQuery tag invalidation may not reliably refetch and
    // re-render. Wait briefly for a cache-driven update, then reload if needed.
    const entryLocator = this.page
      .locator('[data-testid^="flowsheet-entry-"]', { hasText: data.song })
      .first();
    try {
      await entryLocator.waitFor({ state: "visible", timeout: 3000 });
    } catch {
      // Cache invalidation didn't render the entry — force a reload
      await this.page.reload();
      await this.page.waitForLoadState("domcontentloaded");
      await entryLocator.waitFor({ state: "visible", timeout: 10000 });
    }
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
