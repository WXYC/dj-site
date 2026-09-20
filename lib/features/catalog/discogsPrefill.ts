import { serverMessage, unwrapEndpointErrorOrRaw } from "@/lib/rtk-endpoint-error";

/**
 * Helpers behind the rotation filing bench's "Autopopulate with Discogs link"
 * field: the definitive-link the resolved release records, and the inline
 * message a failed autopopulate shows.
 */

/** The canonical definitive link recorded for a resolved Discogs release. */
export function discogsReleaseUrl(releaseId: number): string {
  return `https://www.discogs.com/release/${releaseId}`;
}

const DISCOGS_HOST = /(^|\.)discogs\.com$/i;

/**
 * A Discogs *release* link, in any of the shapes the backend's own parser
 * accepts (scheme-less, `www.`, subdomains). Bare ids and master links are not
 * release links, so they never match — a master link the operator kept as a
 * reference row survives the fold below.
 */
function isDiscogsReleaseUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  try {
    const parsed = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return DISCOGS_HOST.test(parsed.hostname) && /\/release\/\d+/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Fold the resolved release's canonical Discogs link into the release's
 * definitive-links list, first and exactly once: any Discogs release link
 * already present is dropped so a re-autopopulate corrects the record rather
 * than accumulating stale links. Non-Discogs rows (and their order) are kept.
 */
export function withDefinitiveDiscogsUrl(urls: string[], releaseId: number): string[] {
  return [discogsReleaseUrl(releaseId), ...urls.filter((url) => !isDiscogsReleaseUrl(url))];
}

const GENERIC_AUTOFILL_ERROR =
  "Couldn't autopopulate from that link. Enter the release details manually.";

/**
 * The inline message a failed autopopulate shows. The backend's named 4xx
 * messages are operator-facing ("Discogs master links cannot be
 * autopopulated…", "Discogs has no release for that link"), so they are shown
 * verbatim; a hard upstream failure (5xx, timeout, network) falls back to the
 * generic message so no LML-internal detail leaks to the bench. Reads through
 * the `getDiscogsPrefill` error nesting as well as a bare error object.
 */
export function discogsPrefillErrorMessage(error: unknown): string {
  const unwrapped = unwrapEndpointErrorOrRaw("discogsPrefillError", error);
  if (!unwrapped) return GENERIC_AUTOFILL_ERROR;

  const status = unwrapped.status;
  if (typeof status !== "number" || status < 400 || status >= 500) {
    return GENERIC_AUTOFILL_ERROR;
  }

  return serverMessage(unwrapped.data) ?? GENERIC_AUTOFILL_ERROR;
}
