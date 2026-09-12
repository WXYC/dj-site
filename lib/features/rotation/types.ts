import { RotationBin } from "@wxyc/shared/dtos";

export { RotationBin };

// Backward-compatible alias for consumers that import { Rotation }
export const Rotation = RotationBin;
export type Rotation = RotationBin;

export type RotationFrontendState = {
  orderBy: "title" | "artist" | "album";
  orderDirection: "asc" | "desc";
};

/**
 * Canonical bin display order: Heavy, Medium, Light, Singles.
 *
 * Also the accepted-bin vocabulary, not just a presentation order: the catalog
 * tag filter derives which `tags` values count as rotation bins from this
 * array, and the cached-query parser derives which parse. Narrowing it to hide
 * a chip would drop that bin from saved URLs and from optimistic cache
 * matching, so hide at the render site instead.
 */
export const ROTATION_BINS = [
  RotationBin.H,
  RotationBin.M,
  RotationBin.L,
  RotationBin.S,
] as const satisfies readonly RotationBin[];

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
 * Wire shape of Backend's published rotation surface -- one shape for three
 * endpoints: `GET /library/rotation/uncatalogued`, `GET /library/rotation/:id`
 * and `PATCH /library/rotation/:rotation_id/link` all answer with it
 * (`UNCATALOGUED_ROTATION_PROJECTION` / `toRotationRowSummary`,
 * `apps/backend/services/library.service.ts`).
 *
 * `@wxyc/shared` publishes the same surface as `RotationRowSummary`, with
 * every field but `id`, `rotation_bin` and `add_date` declared optional --
 * the generator's rendering of a nullable column, not a claim that the server
 * omits the key. This mirror keeps them required-and-nullable, which is what
 * the display code actually branches on.
 *
 * `format_id` and `label_id` are the rotation row's **own** pre-catalog
 * fields, captured at rotation-add and never the linked library release's.
 * They are typically NULL on a linked row and on every row added before the
 * classic add form started sending them. The sibling list read
 * `GET /library/rotation` publishes the *library release's* `label_id` under
 * the same key name (see `RotationListRow`), so the two must never be read
 * interchangeably: the import screen exists to catalog exactly the
 * pre-catalog snapshot that has not been reconciled with a library row yet.
 * Neither field carries a display name -- the projection is join-free by
 * design, and names resolve client-side through the catalog's `getFormats`.
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
  format_id: number | null;
  label_id: number | null;
};

/**
 * Arguments for `PATCH /library/rotation/:rotation_id/link`: the row in the
 * path and the release in the body. Deliberately not the published
 * `LinkRotationRequest`, which is the body alone (`{ album_id }`) and so
 * cannot name the row being linked.
 */
export type LinkRotationArgs = {
  rotation_id: number;
  album_id: number;
};

/**
 * `POST /library/rotation` body for a release with no catalogued album --
 * Backend relaxed the endpoint to accept `artist_name` + `album_title` in
 * place of `album_id`. Deliberately not the published `@wxyc/shared`
 * `AddRotationRequest`: that type still requires `album_id: number` and has
 * not been widened for the free-text path (see `pickAddRotationFields` in
 * `apps/backend/controllers/library.controller.ts`).
 *
 * `format_id` and `label_id` are accepted only on that same uncatalogued
 * branch, exactly like the free-text trio: on a linked add the format and the
 * label are the library row's to state, and a rotation-side copy would drift
 * from it. Both are optional-and-omitted rather than nullable: Backend picks
 * them with `!= null`, so an explicit `null` reads as absent, and a caller
 * that means "no label" must leave the key off rather than send one.
 */
export type FreeTextRotationAddRequest = {
  rotation_bin: RotationBin;
  artist_name: string;
  album_title: string;
  record_label?: string;
  format_id?: number;
  label_id?: number;
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
