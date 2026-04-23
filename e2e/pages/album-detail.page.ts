import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Album Detail Modal
 *
 * The album detail modal opens as an intercepting route overlay
 * (`@information/(.)album/[id]`) when navigating to `/dashboard/album/:id`
 * from within the dashboard. It displays album metadata fetched from the
 * catalog API and enriched with Discogs/streaming data.
 */
export class AlbumDetailPage {
  readonly page: Page;

  // Modal container
  readonly modal: Locator;

  // Album header
  readonly albumTitle: Locator;
  readonly closeButton: Locator;
  readonly artwork: Locator;

  // Library status
  readonly libraryStatus: Locator;
  readonly markMissingButton: Locator;
  readonly markFoundButton: Locator;

  // Streaming links
  readonly streamingLinks: Locator;

  // Tracklist
  readonly tracklist: Locator;
  readonly noTracklistMessage: Locator;

  // Footer
  readonly playsCount: Locator;
  readonly addedDate: Locator;
  readonly discogsLink: Locator;

  // Error state
  readonly errorCard: Locator;
  readonly goBackButton: Locator;

  // Loading state
  readonly loadingCard: Locator;

  constructor(page: Page) {
    this.page = page;

    // The modal is a MUI Modal wrapping a Card
    this.modal = page.locator(".MuiModal-root");

    // The title is rendered as "Artist Name * Album Title" inside a Typography
    this.albumTitle = this.modal.locator('[class*="MuiTypography"][class*="title-lg"]');
    this.closeButton = this.modal.locator('[class*="ModalClose"]');
    this.artwork = this.modal.locator('img[alt*="cover"]');

    // Library status chips
    this.libraryStatus = this.modal.locator(':text("In Library"), :text("Missing since")');
    this.markMissingButton = this.modal.locator(':text("Mark Missing")');
    this.markFoundButton = this.modal.locator(':text("Mark Found")');

    // Streaming links are rendered as Chip components with anchor tags
    this.streamingLinks = this.modal.locator('a[class*="MuiChip"]');

    // Tracklist table
    this.tracklist = this.modal.locator("table");
    this.noTracklistMessage = this.modal.locator(':text("No tracklist available")');

    // Footer section (CardOverflow)
    this.playsCount = this.modal.locator(':text("plays")');
    this.addedDate = this.modal.locator(':text("Added")');
    this.discogsLink = this.modal.locator('a:has-text("Discogs")');

    // Error state
    this.errorCard = this.modal.locator(':text("Ack!")');
    this.goBackButton = this.modal.locator('button:has-text("Go Back")');

    // Loading state (skeleton)
    this.loadingCard = this.modal.locator('[class*="Skeleton"]');
  }

  /**
   * Navigate directly to the album detail modal via URL.
   * This triggers the intercepting route within the dashboard.
   */
  async goto(albumId: number): Promise<void> {
    await this.page.goto(`/dashboard/album/${albumId}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Wait for the modal to become visible.
   */
  async waitForModal(): Promise<void> {
    await this.modal.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Wait for album data to load (title becomes visible).
   */
  async waitForAlbumLoaded(): Promise<void> {
    await this.albumTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Close the modal by clicking the close button.
   */
  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 5000 });
  }

  // --- Assertions ---

  async expectModalVisible(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.modal).not.toBeVisible();
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
    // Either a tracklist table or a "No tracklist available" message should be visible
    const hasTracklist = await this.tracklist.isVisible().catch(() => false);
    const hasNoTracklist = await this.noTracklistMessage.isVisible().catch(() => false);
    expect(hasTracklist || hasNoTracklist).toBe(true);
  }
}
