import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Flowsheet (/dashboard/flowsheet)
 *
 * Locators use the real DOM: headings, placeholders, table rows, and tooltip
 * labels. Production components stay free of data-testid; unit tests keep
 * testids in *.test.tsx mocks where helpful.
 */
export class FlowsheetPage {
  readonly page: Page;

  /**
   * Go Live / Leave + status live in one Joy ButtonGroup (first control is
   * go/leave IconButton; second is read-only status). Scoped this way so we
   * do not depend on autoplay or other header controls.
   */
  private readonly goLiveControlsGroup: Locator;

  readonly searchForm: Locator;
  readonly songInput: Locator;
  readonly artistInput: Locator;
  readonly albumInput: Locator;
  readonly labelInput: Locator;
  readonly submitButton: Locator;
  /** Dropdown sheet when search is open; best located after opening search */
  readonly searchResults: Locator;
  readonly newEntryPreview: Locator;

  readonly talksetButton: Locator;
  readonly breakpointButton: Locator;

  readonly goLiveButton: Locator;
  readonly liveStatus: Locator;

  /** Second table on the page: queue is first, flowsheet entries second */
  readonly entriesTable: Locator;

  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.goLiveControlsGroup = this.page.locator("[class*='ButtonGroup']").filter({
      has: this.page.getByRole("button", { name: /You Are (On|Off) Air/ }),
    });
    this.goLiveButton = this.goLiveControlsGroup.getByRole("button").first();
    this.liveStatus = this.goLiveControlsGroup.getByRole("button", {
      name: /You Are (On|Off) Air/,
    });

    this.searchForm = this.page.locator("form").filter({
      has: this.page.getByPlaceholder("Song"),
    });
    this.songInput = this.page.getByPlaceholder("Song");
    this.artistInput = this.page.getByPlaceholder("Artist");
    this.albumInput = this.page.getByPlaceholder("Album");
    this.labelInput = this.page.getByPlaceholder("Label");
    this.submitButton = this.searchForm.locator("button").last();
    this.searchResults = this.page
      .locator(".MuiSheet-root")
      .filter({ hasText: /From Your Mail Bin|From Rotation|From the Card Catalog/ });
    this.newEntryPreview = this.page
      .locator(".MuiSheet-root")
      .filter({ hasText: /From Your Mail Bin|From Rotation|From the Card Catalog/ })
      .locator(".MuiStack-root")
      .first();

    this.talksetButton = this.page.getByRole("button", { name: "Add a Talkset" });
    this.breakpointButton = this.page.getByRole("button", {
      name: /Add a.*breakpoint/i,
    });

    this.entriesTable = this.page.locator("table").nth(1);

    this.successToast = this.page.locator(
      '[data-sonner-toast][data-type="success"]'
    );
    this.errorToast = this.page.locator('[data-sonner-toast][data-type="error"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/flowsheet");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForEntriesLoaded(): Promise<void> {
    await this.page
      .getByRole("heading", { level: 2, name: "Flowsheet" })
      .waitFor({ state: "visible", timeout: 15000 });
    await expect(this.liveStatus).toBeVisible({ timeout: 15000 });
    await expect(this.goLiveButton).toBeVisible({ timeout: 15000 });
    await expect(this.entriesTable).toBeVisible({ timeout: 25000 });
    await this.page.waitForTimeout(500);
  }

  async goLive(): Promise<void> {
    await expect(this.goLiveButton).toBeEnabled({ timeout: 10000 });
    await this.page.waitForTimeout(300);
    await this.goLiveButton.click();
    await expect(this.liveStatus).toContainText("On Air", { timeout: 10000 });
    await expect(this.songInput).toBeEnabled({ timeout: 5000 });
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

  async fillSearchForm(data: {
    song: string;
    artist: string;
    album?: string;
    label?: string;
  }): Promise<void> {
    await this.songInput.click();
    await this.songInput.fill(data.song);
    await this.artistInput.fill(data.artist);
    if (data.album) await this.albumInput.fill(data.album);
    if (data.label) await this.labelInput.fill(data.label);
    await this.page.waitForTimeout(100);
  }

  async submitViaButton(): Promise<void> {
    await this.submitButton.click();
  }

  async submitViaEnter(): Promise<void> {
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
    await expect(this.songInput).toHaveValue("", { timeout: 10000 });
  }

  /**
   * A row in the flowsheet entries table (not the queue) that contains the text.
   */
  getEntryRowContaining(text: string): Locator {
    return this.getAllEntries().filter({ hasText: text }).first();
  }

  getAllEntries(): Locator {
    return this.entriesTable.locator("tbody tr");
  }

  async expectEntryCount(count: number, timeout = 10000): Promise<void> {
    await expect(this.getAllEntries()).toHaveCount(count, { timeout });
  }

  async expectEntryWithText(text: string, timeout = 10000): Promise<void> {
    await expect(this.getEntryRowContaining(text)).toBeVisible({ timeout });
  }

  async countEntriesWithText(text: string): Promise<number> {
    return this.getAllEntries().filter({ hasText: text }).count();
  }

  async getEntryTexts(): Promise<string[]> {
    const entries = this.getAllEntries();
    const count = await entries.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      texts.push((await entries.nth(i).textContent()) ?? "");
    }
    return texts;
  }

  /**
   * Double-click visible track title text in the matching row, edit, blur to save.
   */
  async editEntryRowContaining(
    currentTitle: string,
    newTitle: string
  ): Promise<void> {
    const entry = this.getEntryRowContaining(currentTitle);
    // Typography appends nbsp; avoid exact match on the full accessible string
    await entry.getByText(currentTitle, { exact: false }).first().dblclick();
    const input = entry.locator('input[type="text"]').first();
    await input.fill(newTitle);
    await this.page.locator("h2").first().click();
  }
}
