import type { AddArtistConflict } from "./types";

/** Empty or non-numeric strings must not become 0 (Number("") === 0). */
export function parseRequiredPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  // Base-10 positive integers only — reject scientific/hex (Number("1e3") === 1000).
  if (trimmed === "" || !/^[1-9]\d*$/.test(trimmed)) return null;
  return Number(trimmed);
}

/**
 * True when a `POST /library/artists` submission was refused as conflicting,
 * whatever the reason. Resubmitting the same triple unchanged can only be
 * refused the same way, so this — not the body's shape — is what a caller
 * gates resubmission on.
 *
 * Deliberately blind to the body: the backend's only 409 is the code-taken
 * one, but an intermediary can answer 409 with JSON of its own, and a body
 * that fails to parse narrows what can be *said* about the refusal, never
 * whether one happened.
 */
export function isConflictRejection(
  err: unknown,
): err is { status: 409; data: unknown } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  return (err as { status?: unknown }).status === 409;
}

/**
 * True when a `POST /library/artists` rejection is the code-taken 409 naming
 * the artist that already holds the code — the only one a caller can report by
 * name instead of as a generic failure.
 *
 * Two places have to agree on this exact test, which is why it is one function
 * rather than two: the endpoint drops the body's generic `message` so the
 * recoverable outcome is reported once rather than as a banner plus a toast,
 * and the caller dereferences `artist.artist_name` while rendering that banner
 * with no error boundary beneath it. Were the strip the broader test, a second
 * 409 reason — or an intermediary answering 409 with its own JSON — would lose
 * its message before anything could surface it, leaving only a generic
 * fallback. Were the banner's the broader one, it would throw on a body that
 * carries no artist.
 */
export function isAddArtistConflict(
  err: unknown,
): err is { status: 409; data: AddArtistConflict } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  const { status, data } = err as { status?: unknown; data?: unknown };
  if (status !== 409 || !data || typeof data !== "object") return false;
  const { artist } = data as { artist?: unknown };
  return (
    !!artist &&
    typeof artist === "object" &&
    typeof (artist as { artist_name?: unknown }).artist_name === "string"
  );
}
