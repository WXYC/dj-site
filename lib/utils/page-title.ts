const SITE_TITLE = "WXYC";

/**
 * Formats a page title with the site title prefix
 * @param pageTitle - The page-specific title
 * @returns Formatted title in the format "WXYC | {pageTitle}"
 */
export function getPageTitle(pageTitle: string): string {
  return `${SITE_TITLE} | ${pageTitle}`;
}
