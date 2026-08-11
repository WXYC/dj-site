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
 * Deliberately blind to the body: the backend answers 409 for more than one
 * reason (the code-triple conflict, the genre-scoped artist-name conflict),
 * an intermediary can answer 409 with JSON of its own, and a body that fails
 * to parse narrows what can be *said* about the refusal, never whether one
 * happened.
 */
export function isConflictRejection(
  err: unknown,
): err is { status: 409; data: unknown } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  return (err as { status?: unknown }).status === 409;
}

/**
 * True when a `POST /library/artists` rejection is a 409 that names an
 * artist the request conflicts with — the shape both the code-triple
 * conflict and the genre-scoped artist-name conflict share, so a caller can
 * report by name instead of as a generic failure. Which of the two it is is
 * a separate question, answered by `isArtistNameConflictData` against the
 * same body.
 *
 * Two places have to agree on this exact test, which is why it is one function
 * rather than two: the endpoint drops the body's generic `message` so the
 * recoverable outcome is reported once rather than as a banner plus a toast,
 * and the caller dereferences `artist.artist_name` while rendering that banner
 * with no error boundary beneath it. Were the strip the broader test, a 409
 * reason this form cannot name an artist from — or an intermediary answering
 * 409 with its own JSON — would lose its message before anything could
 * surface it, leaving only a generic fallback. Were the banner's the broader
 * one, it would throw on a body that carries no artist.
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

/**
 * True when a `POST /library/artists` 409 body identifies itself as the
 * genre-scoped artist-name conflict rather than the pre-existing code-triple
 * conflict. The discriminant is `reason === "artist_name_conflict"` on the
 * raw body; every other value — including a body with no `reason` field at
 * all, which is exactly what today's deployed backend sends on its one 409 —
 * is the code-triple case. Takes the raw, untyped body rather than routing
 * through `isAddArtistConflict` so the distinction stays correct even against
 * a body this form cannot otherwise name an artist from.
 */
export function isArtistNameConflictData(
  data: unknown,
): data is { reason: "artist_name_conflict" } {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { reason?: unknown }).reason === "artist_name_conflict"
  );
}
