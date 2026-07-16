import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";
import { AlbumEntry, AlbumSearchResultJSON, Format, Genre } from "./types";

function isSearchResult(
  response: AlbumSearchResultJSON | BinLibraryDetails
): response is AlbumSearchResultJSON {
  return "id" in response && response.id !== undefined;
}

// Stable synthetic id for rows with null/missing canonical id (BS catalog
// proxy returns `id: null` for LML-only/unlinked-rotation rows, dj-site#564 +
// Backend-Service#689) — without one, such rows collapse to a single React key.
//
// Derived from the row snapshot so it stays stable across renders, and
// negated so it can't collide with real positive album ids. Hash includes
// `rotation_id` when present: two rows with identical content but different
// rotation_ids (dj-site#626 rotation-picker variant) would otherwise hash
// equal and share a key.
//
// A genuinely contentless row (every field empty AND no rotation_id — the
// all-null "|||||" case in #626) has nothing to hash deterministically, so it
// falls back to a per-call counter; it remounts across renders each
// conversion, which is fine since it carries no identity to preserve.
//
// Known follow-up (dj-site#608, out of scope): the synthetic id leaks to the
// wire from bin operations, and Backend-Service treats a negative album_id as
// a present FK, so `getAlbumFromDB(-X)` returns undefined and the next line
// throws before FK validation can 4xx (`flowsheet.controller.ts:255,260`).
// The unlinked-row e2e in `conversions.test.ts` pins the current wire shape.

// Counter is offset one below the 32-bit hash range: the hashed id is
// -(Math.abs(hash) || 1) with hash coerced via `| 0`, so its true minimum is
// -(2**31) exactly (Math.abs(-2147483648) === 2147483648). Do NOT simplify
// this base to -(2**31) — it must stay strictly below the hash floor.
const CONTENTLESS_ID_BASE = -(2 ** 31) - 1;
let contentlessIdCounter = 0;
function nextContentlessId(): number {
  return CONTENTLESS_ID_BASE - contentlessIdCounter++;
}

function synthesizeAlbumId(
  response: AlbumSearchResultJSON | BinLibraryDetails
): number {
  const snapshot = [
    response.artist_name ?? "",
    response.album_title ?? "",
    response.label ?? "",
    response.code_letters ?? "",
    response.code_artist_number ?? "",
    response.code_number ?? "",
  ].join("|");
  const rotationId =
    "rotation_id" in response && response.rotation_id != null
      ? String(response.rotation_id)
      : "";

  if (snapshot.replace(/\|/g, "") === "" && rotationId === "") {
    return nextContentlessId();
  }

  const key = `${snapshot}|${rotationId}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return -(Math.abs(hash) || 1);
}

export function convertToAlbumEntry(
  response: AlbumSearchResultJSON | BinLibraryDetails
): AlbumEntry {
  const rawId = isSearchResult(response)
    ? response.id
    : (response as BinLibraryDetails).album_id;
  const id =
    typeof rawId === "number" && Number.isFinite(rawId) && rawId > 0
      ? rawId
      : synthesizeAlbumId(response);

  return {
    id,
    title: response.album_title ?? "",
    artist: {
      name: response.artist_name ?? "",
      lettercode: response.code_letters ?? "",
      numbercode: response.code_artist_number ?? 0,
      genre: (response.genre_name as Genre) ?? "Unknown",
      id: isSearchResult(response)
        ? ((response as Record<string, unknown>).artist_id as number | undefined)
        : undefined,
    },
    entry: response.code_number ?? 0,
    format: (response.format_name as Format) ?? "Unknown",
    alternate_artist: isSearchResult(response)
      ? ((response as Record<string, unknown>).alternate_artist_name as string | undefined) ?? ""
      : "",
    album_artist: isSearchResult(response) ? response.album_artist : undefined,
    // rotation_bin/rotation_id populate on every rotation row independently
    // of the LEFT JOIN to library, so must NOT be gated on isSearchResult
    // (keyed on library.id) — that dropped rotation linkage for unlinked
    // rows (dj-site#691). Narrow with `in` instead of the union discriminator
    // since BinLibraryDetails legitimately lacks these fields.
    rotation_bin:
      "rotation_bin" in response
        ? (response.rotation_bin as Rotation | undefined)
        : undefined,
    add_date: isSearchResult(response) ? response.add_date : undefined,
    plays: isSearchResult(response) ? response.plays : undefined,
    // Rotation rows are typed AlbumSearchResultJSON but actually carry
    // record_label (BS's Rotation schema), not label — without this arm they
    // resolved to "" and posted an empty label back to BS (dj-site#709).
    label:
      ("record_label" in response
        ? (response as { record_label?: string | null }).record_label
        : undefined) ??
      response.label ??
      "",
    rotation_id:
      "rotation_id" in response ? response.rotation_id : undefined,
    on_streaming: isSearchResult(response) ? (response as Record<string, unknown>).on_streaming as boolean | undefined : undefined,
    date_lost: isSearchResult(response) ? (response as Record<string, unknown>).date_lost as string | null | undefined : undefined,
    date_found: isSearchResult(response) ? (response as Record<string, unknown>).date_found as string | null | undefined : undefined,
    artwork_url: isSearchResult(response) ? (response as Record<string, unknown>).artwork_url as string | null | undefined : undefined,
    matched_via: isSearchResult(response) ? response.matched_via : undefined,
    artist_id: isSearchResult(response)
      ? (response as Record<string, unknown>).artist_id as number | undefined
      : undefined,
    genre_id: isSearchResult(response)
      ? (response as Record<string, unknown>).genre_id as number | undefined
      : undefined,
    format_id: isSearchResult(response)
      ? (response as Record<string, unknown>).format_id as number | undefined
      : undefined,
    disc_quantity: isSearchResult(response)
      ? (response as Record<string, unknown>).disc_quantity as number | undefined
      : undefined,
  };
}

