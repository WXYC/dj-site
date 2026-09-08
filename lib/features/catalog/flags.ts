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

/**
 * Gates the librarian entries in the classic navigation bar.
 *
 * The screens themselves stay URL-reachable and server-gated whether or not
 * this is set — it controls discoverability, not authority. Every push to main
 * deploys, so the surface lands incrementally across several releases; leaving
 * it OFF keeps a half-built menu out of a working librarian's way until the
 * whole set is present.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED
 * to "true" (or "1").
 */
export function isClassicLibrarianNavEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_CLASSIC_LIBRARIAN_NAV_ENABLED;
  return envValue === "true" || envValue === "1";
}

/**
 * Gates the two library cross-reference entries in the classic Music
 * Department menu.
 *
 * Separate from the librarian-nav flag rather than riding it: that one is
 * already ON in production and preview, so sharing it would publish these
 * entries the moment this ships — and their Backend endpoints
 * (`GET /library/crossreferences/artists|releases`) are not on a deployed
 * backend yet. An entry leading to a screen the API cannot answer is worse
 * than no entry, because the collections it shows exist nowhere else in the
 * app for a librarian to check the screen against.
 *
 * Both screens stay URL-reachable and server-gated whether or not this is set
 * — it controls discoverability, not authority.
 *
 * Defaults to OFF; flip on by setting NEXT_PUBLIC_CLASSIC_CROSSREFERENCES_ENABLED
 * to "true" (or "1") once Backend-Service is serving both endpoints in prod.
 */
export function isClassicCrossReferencesEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_CLASSIC_CROSSREFERENCES_ENABLED;
  return envValue === "true" || envValue === "1";
}
