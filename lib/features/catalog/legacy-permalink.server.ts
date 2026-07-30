import "server-only";
import { getServerJwtToken } from "../authentication/server-client";

/**
 * The dj-site legacy permalink front door maps a tubafrenzy
 * `LIBRARY_RELEASE.ID` — the id LML lookups, the Slack request line, and
 * wxyc.info hand out — to the Backend-Service serial `library.id` that the
 * canonical `/dashboard/album/[id]` route and `GET /library/info?album_id=`
 * are keyed on. The two id spaces are distinct: Backend-Service stores the
 * legacy id in a separate `library.legacy_release_id` column, so a legacy id
 * can never be used as a serial directly. `GET /library/info?legacy_release_id=`
 * performs the bridge server-side.
 */

export type LegacyPermalinkResolution =
  | { status: "resolved"; serial: number }
  | { status: "not-found" };

const LIBRARY_INFO_PATH = "/library/info";

/** The canonical serial-keyed album route the resolved front door redirects to. */
export function albumSerialPath(serial: number): string {
  return `/dashboard/album/${serial}`;
}

function parseLegacyReleaseId(raw: string): number | null {
  // Strict Number() mirrors the Backend-Service guard: trailing garbage
  // ("65880xyz") and a non-positive id are both rejected, rather than a partial
  // parseInt fabricating an id from the leading digits.
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return null;
  }
  return n;
}

// A wedged Backend-Service must not hang the permalink render forever. This is
// the redirect critical path, not a fail-open seed, so the bound is generous —
// a false "not in catalog" for a release that IS catalogued is worse than a
// short wait — but finite.
const RESOLVE_TIMEOUT_MS = 5000;

/**
 * Resolve a legacy release id (the `[legacyId]` route segment) to a
 * Backend-Service serial via `GET /library/info?legacy_release_id=`. The call
 * is authenticated with a server-minted bearer JWT (the browser session cookie
 * is scoped to the dj-site origin, not to Backend-Service).
 *
 * Every non-resolving outcome — an invalid id, no catalog row (a `library.db`
 * release not yet synced into Backend-Service Postgres), or a transient
 * BS/auth failure — collapses to `not-found`, which the caller renders as a
 * non-cacheable page so a later sync is picked up on retry.
 */
export async function resolveLegacyReleaseId(
  legacyIdParam: string,
  cookieHeader: string,
): Promise<LegacyPermalinkResolution> {
  const legacyId = parseLegacyReleaseId(legacyIdParam);
  if (legacyId === null) {
    return { status: "not-found" };
  }

  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) {
    return { status: "not-found" };
  }

  const token = await getServerJwtToken(cookieHeader);
  if (!token) {
    return { status: "not-found" };
  }

  try {
    const response = await fetch(
      `${base}${LIBRARY_INFO_PATH}?legacy_release_id=${legacyId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      },
    );

    // 200 => resolved; 404 (no row) / 400 (bad id) / 5xx / anything else =>
    // not-found. None of the non-200 cases are cached, so a release that syncs
    // later resolves on the next visit.
    if (response.status !== 200) {
      return { status: "not-found" };
    }

    const body = (await response.json()) as { id?: unknown };
    if (typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0) {
      return { status: "resolved", serial: body.id };
    }
    return { status: "not-found" };
  } catch {
    return { status: "not-found" };
  }
}
