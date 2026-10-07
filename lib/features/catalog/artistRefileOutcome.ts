import {
  bodyCode,
  bodyReason,
  serverMessage,
  unwrapEndpointError,
  unwrapEndpointErrorOrRaw,
} from "@/lib/rtk-endpoint-error";
import type { ArtistRefileConflictHolder } from "./types";

/** A sub-500 answer reached a handler that declined before writing; anything else may have written. Mirrors `artistDeleteAnsweredWithoutWriting`. */
export function artistRefileAnsweredWithoutWriting(err: unknown): boolean {
  const status = unwrapEndpointErrorOrRaw("refileArtistError", err)?.status;
  return typeof status === "number" && status < 500;
}

export const ARTIST_REFILE_LOCK_MESSAGE =
  "Could not re-file: someone else is editing the shelf right now. Try again in a moment.";
export const ARTIST_REFILE_LETTERED_MESSAGE =
  "This artist is filed in a lettered compilation section, whose number cannot be changed here. Nothing was changed.";
export const ARTIST_REFILE_VARIOUS_ARTISTS_MESSAGE =
  "This artist is filed in a Various Artists section, whose number cannot be changed here. Reload the card. Nothing was changed.";
export const ARTIST_REFILE_NOT_FILED_MESSAGE =
  "This artist is not filed under that genre any more. Reload the card. Nothing was changed.";
export const ARTIST_REFILE_NOT_FOUND_MESSAGE =
  "This artist is no longer in the catalog. Nothing was changed.";
export const ARTIST_REFILE_CONFLICT_MESSAGE =
  "That number is held by another artist. Nothing was changed.";
export const ARTIST_REFILE_FALLBACK_MESSAGE =
  "This artist could not be re-filed, and the reason could not be read. Nothing was changed.";
export const ARTIST_REFILE_INDETERMINATE_MESSAGE =
  "This artist may or may not have been re-filed — no answer came back. Reload before trying again.";

type Common = { message: string; retryable: boolean };

/** Why `POST /library/artists/:id/refile` did not re-file. `generic` is every shape this module declines to interpret. */
export type ArtistRefileRefusal =
  | (Common & { reason: "conflict"; holder?: ArtistRefileConflictHolder })
  | (Common & {
      reason:
        | "lettered_section"
        | "various_artists_section"
        | "not_filed_in_genre"
        | "artist_not_found"
        | "lock_unavailable"
        | "generic";
    });

/** Interprets a rejected `refileArtist`; never throws on an unexpected body. */
export function interpretArtistRefileError(err: unknown): ArtistRefileRefusal {
  const inner = unwrapEndpointError("refileArtistError", err);
  if (!inner) {
    return { reason: "generic", message: ARTIST_REFILE_INDETERMINATE_MESSAGE, retryable: true };
  }
  const { status, data } = inner;
  const reason = bodyReason(data);

  if (status === 409 && reason === "artist_code_conflict") {
    const artist = (data as { artist?: unknown }).artist;
    const holder =
      artist && typeof artist === "object" && typeof (artist as { id?: unknown }).id === "number" &&
      typeof (artist as { artist_name?: unknown }).artist_name === "string" &&
      typeof (artist as { code_letters?: unknown }).code_letters === "string"
        ? (artist as ArtistRefileConflictHolder)
        : undefined;
    return { reason: "conflict", holder, message: ARTIST_REFILE_CONFLICT_MESSAGE, retryable: false };
  }
  if (status === 409 && reason === "lettered_compilation_section") {
    return { reason: "lettered_section", message: ARTIST_REFILE_LETTERED_MESSAGE, retryable: false };
  }
  if (status === 409 && reason === "various_artists_section") {
    return { reason: "various_artists_section", message: ARTIST_REFILE_VARIOUS_ARTISTS_MESSAGE, retryable: false };
  }
  if (status === 404) {
    // `code` first. A string code this module does not know is a newer
    // Backend's answer: refuse generically rather than guess from the
    // message. Only a body with no string code (a Backend that predates it)
    // falls back to the message prefix.
    const code = bodyCode(data);
    if (code === "artist_not_filed_in_genre") {
      return { reason: "not_filed_in_genre", message: ARTIST_REFILE_NOT_FILED_MESSAGE, retryable: false };
    }
    if (code === "artist_not_found") {
      return { reason: "artist_not_found", message: ARTIST_REFILE_NOT_FOUND_MESSAGE, retryable: false };
    }
    if (code !== undefined) {
      return { reason: "generic", message: ARTIST_REFILE_FALLBACK_MESSAGE, retryable: false };
    }
    return serverMessage(data)?.startsWith("Artist not filed under genre")
      ? { reason: "not_filed_in_genre", message: ARTIST_REFILE_NOT_FILED_MESSAGE, retryable: false }
      : { reason: "artist_not_found", message: ARTIST_REFILE_NOT_FOUND_MESSAGE, retryable: false };
  }
  if (status === 503) {
    return {
      reason: "lock_unavailable",
      message: serverMessage(data) ?? ARTIST_REFILE_LOCK_MESSAGE,
      retryable: true,
    };
  }
  return artistRefileAnsweredWithoutWriting(err)
    ? { reason: "generic", message: ARTIST_REFILE_FALLBACK_MESSAGE, retryable: false }
    : { reason: "generic", message: ARTIST_REFILE_INDETERMINATE_MESSAGE, retryable: true };
}
