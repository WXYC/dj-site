import type { AddArtistConflict } from "./types";

/** Empty or non-numeric strings must not become 0 (Number("") === 0). */
export function parseRequiredPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  // Base-10 positive integers only — reject scientific/hex (Number("1e3") === 1000).
  if (trimmed === "" || !/^[1-9]\d*$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * True when a `POST /library/artists` 409 body names the artist already holding
 * the code, which is the only 409 a caller can report by name.
 *
 * Two places have to agree on this exact shape: the endpoint drops the body's
 * generic `message` so the recoverable code-taken outcome is reported once
 * rather than as a banner plus a toast, and the caller dereferences
 * `artist.artist_name` while rendering that banner with no error boundary
 * beneath it. If the strip were the broader test, a second 409 reason — or an
 * intermediary answering 409 with its own JSON — would lose its message before
 * anything could surface it, leaving only a generic fallback.
 */
export function isAddArtistConflictBody(
  data: unknown,
): data is AddArtistConflict {
  if (!data || typeof data !== "object") return false;
  const { artist } = data as { artist?: unknown };
  return (
    !!artist &&
    typeof artist === "object" &&
    typeof (artist as { artist_name?: unknown }).artist_name === "string"
  );
}
