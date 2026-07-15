import type { BinLibraryDetails } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";
import { AlbumEntry, AlbumSearchResultJSON, Format, Genre } from "./types";

function isSearchResult(
  response: AlbumSearchResultJSON | BinLibraryDetails
): response is AlbumSearchResultJSON {
  return "id" in response && response.id !== undefined;
}

// Stable synthetic id for rows whose canonical id is null/missing. The BS
// catalog proxy returns `id: null` for LML-only and unlinked-rotation rows
// (see dj-site#564 + Backend-Service#689); without a synthetic id, multiple
// such rows in one list collapse to a single React key.
//
// The id is derived from the row snapshot so it stays stable across renders
// (React keys depend on it) and is negated so it can't collide with real
// positive album ids. Hash inputs are the six catalog fields
// (artist|album|label|letters|artist_num|num) PLUS `rotation_id` when present:
// two rows with an IDENTICAL populated snapshot but different rotation_ids (the
// rotation-picker variant of dj-site#626) would otherwise hash equal and share
// a key.
//
// Determinism yields only for a genuinely contentless row — every snapshot
// field null/empty AND no rotation_id (the all-null "|||||" case in #626).
// There is nothing to hash deterministically there, so such rows fall back to a
// per-call counter that guarantees distinct keys for the several blank rows a
// single response can carry. The trade-off: an all-null row draws a fresh id on
// each conversion and so remounts across renders — acceptable because the row
// carries no identity to preserve.
//
// Known follow-up (out of scope): dj-site#608 — synthetic id leaks to the wire
// from bin operations (`lib/features/bin/conversions.ts:8,19`,
// `flowsheet/connections.ts:10`). Backend-Service treats a negative album_id as
// a present FK (`flowsheet.controller.ts:255` `if (body.album_id != null)`),
// then `getAlbumFromDB(-X)` returns undefined and the next line
// `albumInfo.record_label = ...` throws TypeError (~line 260) before BS's
// FK-validation can 4xx. The unlinked-row e2e in
// `__tests__/features/catalog/conversions.test.ts` pins the current wire shape,
// so a fix in either layer must update the assertion deliberately.

// Contentless rows can't be distinguished by content. Their counter is placed
// one below the 32-bit hash range: the hashed id is -(Math.abs(hash) || 1)
// with hash coerced via `| 0`, and Math.abs(-2147483648) === 2147483648, so
// the TRUE minimum hashed id is -(2**31) exactly. The base below must stay
// strictly less than that — do not "simplify" it to -(2**31).
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
    // `rotation_bin` and `rotation_id` come from the `rotation` table on the BS
    // /library/rotation read path (see `getRotationFromDB` in
    // Backend-Service/apps/backend/services/library.service.ts:310,313).
    // They're populated on every rotation row independently of the LEFT JOIN
    // to `library`, so they must NOT be gated on `isSearchResult` (which keys
    // on `library.id` being present). Without this, library-unlinked rotation
    // rows lose their rotation linkage in the picker — see dj-site#691, the
    // Yenbett / Noura Mint Seymali symptom (2026-06-02). `BinLibraryDetails`
    // legitimately lacks these fields, so we narrow with an `in`-operator
    // check rather than the union discriminator.
    rotation_bin:
      "rotation_bin" in response
        ? (response.rotation_bin as Rotation | undefined)
        : undefined,
    add_date: isSearchResult(response) ? response.add_date : undefined,
    plays: isSearchResult(response) ? response.plays : undefined,
    // BS `/library/rotation` returns rows shaped by the `Rotation` schema
    // (`@wxyc/shared/api.yaml:1364`), where the label field is `record_label`
    // (BS aliases `COALESCE(library.label, rotation.record_label) AS
    // record_label` in `getRotationFromDB`). The rotation API mistypes the
    // response as `AlbumSearchResultJSON[]` (whose label field is `label`),
    // so the `Rotation` shape sneaks through the union here. The catalog
    // search and bin-details shapes legitimately carry `label`. See
    // dj-site#709 — without the `record_label` arm, rotation rows resolved
    // to `""` and the empty string was POSTed back to BS on submission.
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

