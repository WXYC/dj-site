import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Dashboard
 */
export class DashboardPage {
  readonly page: Page;

  // Navigation elements
  readonly flowsheetLink: Locator;
  readonly catalogLink: Locator;
  readonly adminLink: Locator;
  readonly rosterLink: Locator;
  readonly logoutButton: Locator;

  // User info elements
  readonly userMenu: Locator;
  readonly userName: Locator;

  // Page header
  readonly pageHeader: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation - adjust selectors based on actual UI
    this.flowsheetLink = page.locator('a[href*="/dashboard/flowsheet"], [data-nav="flowsheet"]');
    this.catalogLink = page.locator('a[href*="/dashboard/catalog"], [data-nav="catalog"]');
    this.adminLink = page.locator('a[href*="/dashboard/admin"], [data-nav="admin"]');
    this.rosterLink = page.locator('a[href*="/dashboard/admin/roster"], [data-nav="roster"]');
    this.logoutButton = page.locator('button:has-text("Logout"), form[action*="logout"] button, [aria-label="Logout"]');

    // User info
    this.userMenu = page.locator('[data-user-menu], [aria-label="User menu"]');
    this.userName = page.locator('[data-user-name]');

    // Page header
    this.pageHeader = page.locator('h1, [data-page-header]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoFlowsheet(): Promise<void> {
    await this.page.goto("/dashboard/flowsheet");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoCatalog(): Promise<void> {
    await this.page.goto("/dashboard/catalog");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoAdminRoster(): Promise<void> {
    await this.page.goto("/dashboard/admin/roster");
    await this.page.waitForLoadState("networkidle");
  }

  async navigateToFlowsheet(): Promise<void> {
    await this.flowsheetLink.click();
    await this.page.waitForURL("**/dashboard/flowsheet**");
  }

  async navigateToCatalog(): Promise<void> {
    await this.catalogLink.click();
    await this.page.waitForURL("**/dashboard/catalog**");
  }

  async navigateToAdmin(): Promise<void> {
    await this.adminLink.click();
    await this.page.waitForURL("**/dashboard/admin/**");
  }

  async navigateToRoster(): Promise<void> {
    await this.rosterLink.click();
    await this.page.waitForURL("**/dashboard/admin/roster**");
  }

  async logout(): Promise<void> {
    // Try to click logout button directly first
    const logoutVisible = await this.logoutButton.isVisible();
    if (logoutVisible) {
      await this.logoutButton.click();
    } else {
      // May need to open user menu first
      if (await this.userMenu.isVisible()) {
        await this.userMenu.click();
        await this.logoutButton.click();
      }
    }
    await this.page.waitForURL("**/login**", { timeout: 10000 });
  }

  async expectOnDashboard(): Promise<void> {
    const url = this.page.url();
    expect(url).toContain("/dashboard");
  }

  async expectOnFlowsheet(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/dashboard\/flowsheet.*/);
  }

  async expectOnCatalog(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/dashboard\/catalog.*/);
  }

  async expectOnAdminRoster(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/dashboard\/admin\/roster.*/);
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/login.*/);
  }

  async expectRedirectedToCatalog(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/dashboard\/catalog.*/);
  }

  async expectPageHeader(text: string): Promise<void> {
    await expect(this.pageHeader).toContainText(text);
  }

  async isOnDashboard(): Promise<boolean> {
    return this.page.url().includes("/dashboard");
  }

  async getCurrentPath(): Promise<string> {
    const url = new URL(this.page.url());
    return url.pathname;
  }
}
