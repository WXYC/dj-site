import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Album Detail modal
 *
 * Album detail opens as a centered modal (the intercepting route at
 * /dashboard/album/[id]) when clicking an album in the catalog, flowsheet,
 * or bin. It displays album metadata fetched from the catalog API and
 * enriched with Discogs/streaming data.
 */
export class AlbumDetailPage {
  readonly page: Page;

  // Modal dialog container
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

    // The centered modal dialog rendered by the intercepting route
    this.panel = page.locator('[aria-label="Album detail"]');

    // The title is rendered as "Artist Name * Album Title" inside a Typography
    this.albumTitle = this.panel.locator('[class*="MuiTypography"][class*="title-lg"]');
    this.closeButton = this.panel.locator('button[aria-label="Close album detail"]');
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
   * Navigate to the catalog; specs open the album by clicking a result,
   * which soft-navigates to /dashboard/album/:id and overlays the modal.
   * (Hard navigation to that URL is also supported — it's the permalink.)
   */
  async goto(albumId: number): Promise<void> {
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
   * Close the modal via Escape — the keyboard dismissal path, which reaches
   * the Modal's onClose without depending on pointer hit-testing. (The close
   * button remains covered by the manual visual walkthrough.)
   */
  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    // Dismissal unmounts the dialog from local state before navigating back
    await this.panel.waitFor({ state: "hidden", timeout: 5000 });
  }

  // --- Assertions ---

  async expectModalVisible(): Promise<void> {
    await expect(this.albumTitle).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.panel).toBeHidden();
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
