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
  readonly logoutForm: Locator;
  readonly logoutButton: Locator;

  // User info elements
  readonly userMenu: Locator;
  readonly userName: Locator;

  // Page header
  readonly pageHeader: Locator;

  // Sidebar/leftbar
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation - using actual UI selectors
    this.flowsheetLink = page.locator('a[href="/dashboard/flowsheet"]');
    this.catalogLink = page.locator('a[href="/dashboard/catalog"]');
    this.adminLink = page.locator('a[href*="/dashboard/admin"]');
    this.rosterLink = page.locator('a[href="/dashboard/admin/roster"]');

    // Log out button is in a form in the sidebar - it's an IconButton with type="submit"
    // Select specifically the submit button inside a form (the logout button)
    this.logoutForm = page.locator('form:has(button[type="submit"])');
    this.logoutButton = page.locator('form button[type="submit"]');

    // User info
    this.userMenu = page.locator('[data-user-menu], [aria-label="User menu"]');
    this.userName = page.locator('[data-user-name]');

    // Page header
    this.pageHeader = page.locator('h1, [data-page-header]');

    // Sidebar
    this.sidebar = page.locator('nav, aside, [role="navigation"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async gotoFlowsheet(): Promise<void> {
    await this.page.goto("/dashboard/flowsheet");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async gotoCatalog(): Promise<void> {
    await this.page.goto("/dashboard/catalog");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async gotoAdminRoster(): Promise<void> {
    await this.page.goto("/dashboard/admin/roster");
    await this.page.waitForLoadState("domcontentloaded");
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
    // Logout is a form submission - dispatch submit event on the form
    // Note: Direct button click doesn't trigger onSubmit in this Joy UI setup,
    // so we dispatch the submit event programmatically
    await this.logoutForm.evaluate((form: HTMLFormElement) => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    // Wait for redirect to login page
    await this.page.waitForURL("**/login**", { timeout: 15000 });
  }

  async isAdminLinkVisible(): Promise<boolean> {
    return await this.rosterLink.isVisible();
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
    // Wait for either URL change to login, login form to appear, or 404/error page
    // The app may show a 404 error page instead of redirecting to login when session is invalid
    // Error pages have various headings but consistent body text
    await Promise.race([
      expect(this.page).toHaveURL(/.*\/login.*/, { timeout: 15000 }),
      this.page.locator('input[name="username"]').waitFor({ state: "visible", timeout: 15000 }),
      this.page.getByText("We couldn't find the resource you were looking for").waitFor({ state: "visible", timeout: 15000 }),
    ]);
  }

  async expectRedirectedToCatalog(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/dashboard\/catalog.*/);
  }

  /**
   * Expect redirect to default dashboard page (flowsheet or catalog depending on config)
   */
  async expectRedirectedToDefaultDashboard(): Promise<void> {
    // Wait for navigation to complete
    await this.page.waitForLoadState("domcontentloaded");
    const url = this.page.url();
    // Should be redirected to either flowsheet or catalog (the dashboard home)
    const isValidRedirect = url.includes("/dashboard/flowsheet") || url.includes("/dashboard/catalog");
    expect(isValidRedirect).toBe(true);
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
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
