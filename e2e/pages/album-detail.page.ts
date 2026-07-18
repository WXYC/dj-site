import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the album detail card.
 *
 * The card opens at /dashboard/<page>/album/<id>: as a centered modal for an
 * unpinned album, or docked beside the pinned rail (".DockedPanel") once
 * pinned. The rail itself lives in the minified rightbar (".SecondSidebar").
 */
export class AlbumDetailPage {
  readonly page: Page;

  // Centered modal (unpinned presentation)
  readonly modal: Locator;
  readonly closeButton: Locator;
  readonly pinButton: Locator;

  // Docked panel (pinned presentation)
  readonly dockedPanel: Locator;
  readonly dockedUnpinButton: Locator;
  readonly dockedCollapseButton: Locator;

  // Pinned rail
  readonly rail: Locator;
  readonly railHomeExpandButton: Locator;
  readonly railHomeCollapseButton: Locator;
  readonly railAlbumTiles: Locator;
  readonly railUnpinBadges: Locator;

  constructor(page: Page) {
    this.page = page;

    this.modal = page.locator('[aria-label="Album details"]');
    this.closeButton = page.getByRole("button", { name: "Close album details" });
    this.pinButton = page.getByRole("button", { name: "Pin card to the rail" });

    this.dockedPanel = page.locator(".DockedPanel");
    this.dockedUnpinButton = page.getByRole("button", { name: "Unpin card" });
    this.dockedCollapseButton = page.getByRole("button", { name: "Collapse to rail" });

    this.rail = page.locator(".SecondSidebar");
    this.railHomeExpandButton = page.getByRole("button", { name: "Expand the dashboard panel" });
    this.railHomeCollapseButton = page.getByRole("button", { name: "Collapse the dashboard panel" });
    this.railAlbumTiles = page.getByRole("button", { name: /^Open .+/ });
    this.railUnpinBadges = page.getByRole("button", { name: /^Unpin .+/ });
  }

  /** Hard-navigate to an album permalink. */
  async goto(pagePath: string, albumId: number): Promise<void> {
    await this.page.goto(`${pagePath}/album/${albumId}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForModal(): Promise<void> {
    await this.modal.waitFor({ state: "visible", timeout: 10000 });
  }

  /** Wait for album data inside the modal (any of the given texts). */
  async waitForAlbumLoaded(text: string): Promise<void> {
    await expect(this.modal.getByText(text).first()).toBeVisible({ timeout: 10000 });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.modal.waitFor({ state: "hidden", timeout: 5000 });
  }

  async pin(): Promise<void> {
    await this.pinButton.click();
    await this.dockedPanel.waitFor({ state: "visible", timeout: 5000 });
  }

  // --- Assertions ---

  async expectModalVisible(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.modal).toBeHidden();
  }

  async expectModalText(text: string): Promise<void> {
    await expect(this.modal.getByText(text).first()).toBeVisible({ timeout: 10000 });
  }

  async expectDockedText(text: string): Promise<void> {
    await expect(this.dockedPanel.getByText(text).first()).toBeVisible({ timeout: 10000 });
  }

  async expectDockedCardVisible(): Promise<void> {
    await expect(this.dockedUnpinButton).toBeVisible({ timeout: 10000 });
  }

  async expectRailVisible(): Promise<void> {
    await expect(this.railAlbumTiles.first()).toBeVisible({ timeout: 10000 });
  }

  async expectFullRightbar(): Promise<void> {
    await expect(this.rail.getByText("Now Playing").first()).toBeVisible({ timeout: 10000 });
  }
}
