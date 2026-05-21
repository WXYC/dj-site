/**
 * Catalog feature flags read from public Next.js env vars.
 *
 * Values are inlined at build time, so callers must invoke these helpers at
 * render time rather than at module init.
 */

/**
 * Gates the matched_via track-match chip rendering in catalog search results.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED
 * to "true" (or "1") after Backend-Service is serving matched_via in prod.
 */
export function isCatalogTrackSearchUiEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED;
  return envValue === "true" || envValue === "1";
}
