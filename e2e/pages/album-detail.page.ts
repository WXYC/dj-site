import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Album Detail Panel
 *
 * The album detail panel opens in the rightbar sidebar when clicking
 * an album in the catalog, flowsheet, or bin. It displays album metadata
 * fetched from the catalog API and enriched with Discogs/streaming data.
 */
export class AlbumDetailPage {
  readonly page: Page;

  // Panel container (rightbar sidebar)
  readonly panel: Locator;

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

    // The panel is inside the rightbar sidebar
    this.panel = page.locator(".SecondSidebar");

    // The title is rendered as "Artist Name * Album Title" inside a Typography
    this.albumTitle = this.panel.locator('[class*="MuiTypography"][class*="title-lg"]');
    this.closeButton = this.panel.locator('button[aria-label="Close panel"]');
    this.artwork = this.panel.locator('img[alt*="cover"]');

    // Library status chips
    this.libraryStatus = this.panel.locator(':text("In Library"), :text("Missing since")');
    this.markMissingButton = this.panel.locator(':text("Mark Missing")');
    this.markFoundButton = this.panel.locator(':text("Mark Found")');

    // Streaming links are rendered as Chip components with anchor tags
    this.streamingLinks = this.panel.locator('a[class*="MuiChip"]');

    // Tracklist table
    this.tracklist = this.panel.locator("table");
    this.noTracklistMessage = this.panel.locator(':text("No tracklist available")');

    // Footer section (CardOverflow with variant="soft")
    const footer = this.panel.locator('[class*="CardOverflow"]');
    this.playsCount = footer.locator(':text("plays")');
    this.addedDate = footer.locator(':text("Added")');
    this.discogsLink = footer.locator('a:has-text("Discogs")');

    // Error state
    this.errorCard = this.panel.locator(':text("Ack!")');
    this.goBackButton = this.panel.locator('button:has-text("Go Back")');

    // Loading state (skeleton)
    this.loadingCard = this.panel.locator('[class*="Skeleton"]');
  }

  /**
   * Navigate to the catalog and open an album via search.
   * Direct URL navigation (/dashboard/album/:id) is no longer supported.
   */
  async goto(albumId: number): Promise<void> {
    // Navigate to catalog — the album will be opened via dispatch, not URL
    await this.page.goto(`/dashboard/catalog`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Wait for the panel to show album content.
   */
  async waitForModal(): Promise<void> {
    // Wait for the panel's close button — it's always present when any panel content is shown
    await this.closeButton.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Wait for album data to load (title becomes visible).
   */
  async waitForAlbumLoaded(): Promise<void> {
    await this.albumTitle.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Close the panel by clicking the close button.
   */
  async close(): Promise<void> {
    await this.closeButton.click({ force: true });
    // Wait for default rightbar content to reappear
    await this.panel.locator('text=Now Playing').waitFor({ state: "visible", timeout: 5000 });
  }

  // --- Assertions ---

  async expectModalVisible(): Promise<void> {
    await expect(this.albumTitle).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.panel.locator('text=Now Playing')).toBeVisible();
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
}
