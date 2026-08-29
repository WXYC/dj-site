import { RotationBin } from "@wxyc/shared/dtos";

export { RotationBin };

// Backward-compatible alias for consumers that import { Rotation }
export const Rotation = RotationBin;
export type Rotation = RotationBin;

export type RotationFrontendState = {
  orderBy: "title" | "artist" | "album";
  orderDirection: "asc" | "desc";
};

/** Radio-button label for each rotation bin, matching `rotationReleaseInsert.jsp`'s wording verbatim. */
export const ROTATION_BIN_LABELS: Record<RotationBin, string> = {
  [RotationBin.H]: "Heavy",
  [RotationBin.M]: "Medium",
  [RotationBin.L]: "Light",
  [RotationBin.S]: "Singles",
};

/**
 * Wire shape of a `GET /library/rotation` row — Backend's `Rotation`
 * interface (`apps/backend/services/library.service.ts`), hand-mirrored
 * rather than imported from `@wxyc/shared`. The published `Rotation` DTO
 * there predates the LEFT JOIN rework that lets an unlinked rotation row
 * surface alongside a linked one, and carries a different, narrower field
 * set (`play_freq` instead of `rotation_bin`, no
 * `rotation_add_date`/`rotation_kill_date` split, no `id`/`legacy_release_id`
 * linkage pair). dj-site's pre-existing `getRotation` query works around the
 * drift by treating the response as an `AlbumSearchResultJSON` for its
 * overlapping field names and dropping the rest -- this screen needs exactly
 * the fields that drops: `rotation_id` (the row Kill/Unkill/Edit act on, not
 * `id`, which is the library row and is `null` on an unlinked release),
 * `rotation_bin`, `rotation_add_date`, `rotation_kill_date`.
 */
export type RotationListRow = {
  id: number | null;
  code_letters: string | null;
  code_artist_number: number | null;
  code_number: number | null;
  artist_name: string | null;
  alphabetical_name: string | null;
  album_title: string | null;
  record_label: string | null;
  label_id: number | null;
  genre_name: string | null;
  format_name: string | null;
  rotation_id: number;
  add_date: string | null;
  rotation_add_date: string;
  rotation_bin: RotationBin;
  rotation_kill_date: string | null;
  plays: number | null;
  legacy_release_id: number | null;
};

/**
 * Wire shape of a `GET /library/rotation/uncatalogued` row -- Backend's
 * `UncataloguedRotationRow` (`UNCATALOGUED_ROTATION_PROJECTION`,
 * `apps/backend/services/library.service.ts`). Not yet published to
 * `@wxyc/shared`, whose own maintainer notes intend to transcribe this shape
 * once the endpoint stabilizes; this is a local wire mirror until it lands.
 */
export type UncataloguedRotationRow = {
  id: number;
  album_id: number | null;
  rotation_bin: RotationBin;
  add_date: string | null;
  kill_date: string | null;
  artist_name: string | null;
  album_title: string | null;
  record_label: string | null;
};

/**
 * `POST /library/rotation` body for a release with no catalogued album --
 * Backend relaxed the endpoint to accept `artist_name` + `album_title` in
 * place of `album_id`. Deliberately not the published `@wxyc/shared`
 * `AddRotationRequest`: that type still requires `album_id: number` and has
 * not been widened for the free-text path (see `pickAddRotationFields` in
 * `apps/backend/controllers/library.controller.ts`).
 */
export type FreeTextRotationAddRequest = {
  rotation_bin: RotationBin;
  artist_name: string;
  album_title: string;
  record_label?: string;
};

/**
 * The four facets `rotationReleaseList.jsp`'s chip bar offers, spelled
 * exactly as the JSP's own `status=` query values (including its
 * single-L "uncataloged" -- distinct from the Backend route path
 * `/library/rotation/uncatalogued`, which is not renamable to match).
 */
export type RotationStatusFilter = "all" | "active" | "killed" | "uncataloged";

export const DEFAULT_ROTATION_STATUS_FILTER: RotationStatusFilter = "active";

/**
 * Rows per request for the Awaiting Cataloging queue. Mirrors Backend's own
 * ceiling on `GET /library/rotation/uncatalogued?limit=` -- ask for it
 * explicitly rather than relying on the server's default so a page that
 * comes back this full can be reported as truncated against a number this
 * client actually chose.
 */
export const UNCATALOGUED_ROTATION_PAGE_SIZE = 500;
