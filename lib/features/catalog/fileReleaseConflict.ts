import type { LibraryFilingConflictError } from "@wxyc/shared";

/**
 * True when a `POST /library/filings` submission was refused as a composed
 * write conflict -- the artist code triple, the genre-scoped artist name, or
 * the rotation card/bin mismatch (`LibraryFilingConflictReason`). Narrows the
 * rejection to `fileRelease`'s wrapped error body so a caller can read
 * `reason` and, where present, the conflicting `artist` to name in a banner
 * rather than a generic failure.
 */
export function isLibraryFilingConflict(
  err: unknown,
): err is { status: 409; data: LibraryFilingConflictError } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  const { status, data } = err as { status?: unknown; data?: unknown };
  return status === 409 && !!data && typeof data === "object" && "reason" in data;
}
