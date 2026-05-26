import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Album Detail modal (dashboard @information slot).
 */
export class AlbumDetailPage {
  readonly page: Page;
  readonly modal: Locator;
  readonly albumTitle: Locator;
  readonly closeButton: Locator;
  readonly artwork: Locator;
  readonly libraryStatus: Locator;
  readonly markMissingButton: Locator;
  readonly markFoundButton: Locator;
  readonly streamingLinks: Locator;
  readonly tracklist: Locator;
  readonly noTracklistMessage: Locator;
  readonly playsCount: Locator;
  readonly addedDate: Locator;
  readonly discogsLink: Locator;
  readonly errorCard: Locator;
  readonly goBackButton: Locator;
  readonly loadingCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.getByTestId("album-detail-modal");
    this.albumTitle = this.modal.locator('[class*="MuiTypography"][class*="title-lg"]');
    this.closeButton = this.modal.getByLabel("Close album detail");
    this.artwork = this.modal.locator('img[alt*="cover"]');
    this.libraryStatus = this.modal.locator(':text("In Library"), :text("Missing since")');
    this.markMissingButton = this.modal.locator(':text("Mark Missing")');
    this.markFoundButton = this.modal.locator(':text("Mark Found")');
    this.streamingLinks = this.modal.locator('a[class*="MuiChip"]');
    this.tracklist = this.modal.locator("table");
    this.noTracklistMessage = this.modal.locator(':text("No tracklist available")');
    const footer = this.modal.locator('[class*="CardOverflow"]');
    this.playsCount = footer.locator(':text("plays")');
    this.addedDate = footer.locator(':text("Added")');
    this.discogsLink = footer.locator('a:has-text("Discogs")');
    this.errorCard = this.modal.locator(':text("Ack!")');
    this.goBackButton = this.modal.locator('button:has-text("Go Back")');
    this.loadingCard = this.modal.locator('[class*="Skeleton"]');
  }

  async goto(albumPathSegment: string | number): Promise<void> {
    const segment = encodeURIComponent(String(albumPathSegment));
    await this.page.goto(`/dashboard/catalog/album/${segment}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForModal(): Promise<void> {
    await this.page
      .locator(
        '[data-testid="album-detail-modal"], [data-testid="catalog-edit-modal"], [data-testid="catalog-add-modal"]',
      )
      .first()
      .waitFor({ state: "visible", timeout: 10000 });
  }

  async waitForAlbumLoaded(): Promise<void> {
    await this.albumTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  async close(): Promise<void> {
    await this.closeButton.click({ force: true });
    await this.modal.waitFor({ state: "hidden", timeout: 5000 });
  }

  async expectModalVisible(): Promise<void> {
    await expect(this.modal).toBeVisible();
    await expect(this.albumTitle).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.modal).toBeHidden();
  }

  async expectAlbumTitle(artistAndTitle: string): Promise<void> {
    await expect(this.albumTitle).toContainText(artistAndTitle, { timeout: 10000 });
  }

  async expectArtworkVisible(): Promise<void> {
    await expect(this.artwork).toBeVisible();
  }

  async expectPlaysCount(text: string): Promise<void> {
    await expect(this.playsCount).toContainText(text);
  }

  async expectLibraryStatusVisible(): Promise<void> {
    await expect(this.libraryStatus).toBeVisible();
  }

  async expectErrorState(): Promise<void> {
    await expect(this.errorCard).toBeVisible({ timeout: 10000 });
  }

  async expectTracklistOrFallback(): Promise<void> {
    const hasTracklist = await this.tracklist.isVisible().catch(() => false);
    const hasNoTracklist = await this.noTracklistMessage.isVisible().catch(() => false);
    expect(hasTracklist || hasNoTracklist).toBe(true);
  }

  async openEditTab(tab: "artist" | "album" | "rotation"): Promise<void> {
    await this.page.getByTestId(`catalog-edit-tab-${tab}`).click();
  }

  async clickAddWizardNext(): Promise<void> {
    await this.page.getByTestId("catalog-add-wizard-next").click();
  }
}
