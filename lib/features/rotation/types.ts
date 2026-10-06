import {
  RotationBin,
  type RotationCard,
  type RotationConflictReason,
  type RotationRowSummary,
} from "@wxyc/shared/dtos";

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
 * rather than imported from `@wxyc/shared`. The published `Rotation` declares
 * no `required` list, so every property on it is optional, including
 * `rotation_id`, `rotation_bin` and `rotation_add_date`, which the rotation
 * lists read as always present. It also carries `reconciled_identity`, which
 * this row does not declare.
 *
 * `getRotation` reads the same endpoint but converts each row to an
 * `AlbumEntry`, which carries neither `rotation_add_date` nor
 * `rotation_kill_date`; this type is the row unconverted. `rotation_id` is
 * the row Kill/Unkill/Edit act on, not `id`, which is the library row and is
 * `null` on an unlinked release.
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
  /**
   * Optional like `card` below: the endpoint emits all three on every row, and
   * `?` covers only an older backend. The shared wire type predates them.
   */
  genre_id?: number | null;
  code_comp_letter?: string | null;
  code_volume_letters?: string | null;
  /**
   * Optional, mirroring the published schema exactly (`card?` on `Rotation`).
   * `GET /library/rotation` emits the key on every row, so `?` covers only a
   * backend older than the card join. Absent means "the server didn't say";
   * `null` is the positive claim "no card". The admin list's card guards
   * (`adminList.ts`, `RotationAdminList.tsx`) treat absent and `null` alike,
   * which keeps them correct against that older backend.
   */
  card?: RotationCard | null;
  /**
   * Optional for the same reason as `card` above: the endpoint emits it on
   * every row, and `?` covers only an older backend. The published field's
   * own warning applies here verbatim: plain strings, not `format: uri` --
   * MDs paste bare domains, so a value carries no scheme guarantee and a
   * renderer must not bind one into an href without checking it.
   */
  urls?: string[];
};

/**
 * Backend's published rotation surface -- one shape for three endpoints:
 * `GET /library/rotation/uncatalogued`, `GET /library/rotation/:id` and
 * `PATCH /library/rotation/:rotation_id/link` all answer with it.
 *
 * Re-exported under its historical local name so the rotation feature reads
 * consistently; the declaration is the published contract's, not a mirror of
 * it. Every field but `id`, `rotation_bin` and `add_date` is declared
 * optional there, which is the generator's rendering of a nullable column
 * rather than a claim that the server omits the key -- read it as "the
 * contract declines to promise it".
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
export type { RotationRowSummary };

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
 * Arguments for `PATCH /library/rotation/:id`, the field-level rotation
 * editor: the row in the path, every other key in the body.
 *
 * These eight are the whole writable surface. `rotation_bin` is **not** among
 * them and is not an omission here -- the endpoint accepts the key, answers
 * 200, echoes the row back and leaves the bin unchanged, and no other endpoint
 * can move a row between bins either. Sending it would be a write nobody can
 * see, so nothing sends it. `card_id` is the one within-bin move the endpoint
 * does own: the referenced card must belong to the row's own bin (a mismatch
 * is refused), so a bin move is never expressible through this write.
 *
 * Only the keys present are SET, so a typo fix on one field can never wipe
 * another. That makes the distinction between an absent key and an explicit
 * `null` load-bearing: `null` clears `kill_date`, `format_id` and `label_id`,
 * while the three text fields have no clearing value at all -- the server
 * validates them as non-empty strings, so a blank one is a 400 rather than a
 * cleared column. `card_id` is declared non-nullable deliberately: no surface
 * clears a card (rows only ever move between cards), and widening to the
 * null-clears convention can wait for a caller that needs it.
 *
 * The five pre-catalog fields (everything but the two dates) may only be
 * written while the row is unlinked. Once it carries an `album_id` the library
 * release owns them and the request is refused with a 409.
 */
export type UpdateRotationArgs = {
  rotation_id: number;
  artist_name?: string;
  album_title?: string;
  record_label?: string;
  add_date?: string;
  kill_date?: string | null;
  format_id?: number | null;
  label_id?: number | null;
  card_id?: number;
};

/**
 * `POST /library/rotation` body for a release with no catalogued album: the
 * endpoint accepts `artist_name` + `album_title` in place of `album_id` (see
 * `pickAddRotationFields` in
 * `apps/backend/controllers/library.controller.ts`). Hand-declared because
 * the published `AddRotationRequest` is `RotationCreateFields` plus a
 * required `album_id: number`, with no free-text arm; the generated type
 * replaces this one when the contract declares that arm.
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
  /**
   * Storage order, the published `AddRotationRequest.urls` shape verbatim
   * (plain strings, never `format: uri` — see `RotationListRow.urls`).
   * Carried on a move so a re-filing keeps the source row's links instead
   * of orphaning them on the row it retires. The deployed Backend admits
   * `urls` on both POST arms, so the carry is live; an older backend's add
   * allowlist would silently drop the key instead.
   */
  urls?: string[];
};

/**
 * A `GET /library/rotation/cards` row: the published card plus how many
 * active rotation rows are filed on it. The contract declares the cards-list
 * item as an inline `allOf[RotationCard, {active_count}]` on the response
 * rather than a named `components.schemas` entry, and the package only
 * generates named types for the latter -- there is no generated shape to
 * swap to until the contract names this one.
 */
export type RotationCardWithCount = RotationCard & { active_count: number };

/**
 * The typed half of a rotation-cards DELETE 409 (`{message, reason}`): the
 * server's delete guard is conjunctive — the card must be its bin's
 * highest-numbered AND hold zero active rotation rows — and the reason names
 * which half refused. Narrowed to these two values rather than the full
 * published `RotationConflictReason`: that enum's third value
 * (`rotation_card_bin_mismatch`) belongs to the rotation add path and can
 * never arrive on a delete. The `satisfies` clause below ties the narrowing
 * to the published enum, so a renamed contract value is a compile error
 * instead of a silent mismatch.
 */
export const ROTATION_CARD_DELETE_CONFLICT_REASONS = [
  "card_not_highest_in_bin",
  "card_has_active_rotations",
] as const satisfies readonly RotationConflictReason[];
export type RotationCardDeleteConflictReason =
  (typeof ROTATION_CARD_DELETE_CONFLICT_REASONS)[number];

/**
 * The four facets `rotationReleaseList.jsp`'s chip bar offers, spelled
 * exactly as the JSP's own `status=` query values (including its
 * single-L "uncataloged" -- distinct from the Backend route path
 * `/library/rotation/uncatalogued`, which is not renamable to match).
 */
export type RotationStatusFilter = "all" | "active" | "killed" | "uncataloged";

/**
 * The facets `GET /library/rotation?status=` itself can answer. `uncataloged`
 * is excluded at the type level rather than by convention: that facet is not
 * a filter over this list but a distinct read against a distinct backlog
 * (`getUncataloguedRotation`, `GET /library/rotation/uncatalogued`), and the
 * list endpoint has no rows for it -- a caller sending it would get the
 * default facet back with a 200 and no error signal.
 */
export type RotationListStatusFilter = Exclude<RotationStatusFilter, "uncataloged">;

export const DEFAULT_ROTATION_STATUS_FILTER: RotationListStatusFilter = "active";

/**
 * Rows per request for the Awaiting Cataloging queue. Mirrors Backend's own
 * ceiling on `GET /library/rotation/uncatalogued?limit=` -- ask for it
 * explicitly rather than relying on the server's default so a page that
 * comes back this full can be reported as truncated against a number this
 * client actually chose.
 */
export const UNCATALOGUED_ROTATION_PAGE_SIZE = 500;

/**
 * How many rows of a status facet (`All`, `Killed`) the classic list mounts
 * at once. `GET /library/rotation?status=` is unbounded and those two facets
 * are the station's whole rotation history -- thousands of rows -- where the
 * Active facet is bounded by what is in rotation and the Awaiting Cataloging
 * facet by its own server-side page.
 *
 * A render cap only: the count beside the control names the full set, so a
 * capped view never reads as a complete one. Matches the page the Awaiting
 * Cataloging facet already mounts of the identical table, which is the
 * evidence this table renders that many plain rows comfortably.
 *
 * The modern admin list guards the same unbounded read with the same
 * mechanism and a far smaller batch. The numbers differ because the rows do:
 * a Joy row per entry is the expensive thing there, where this is nine plain
 * table cells. Change one and the other does not follow.
 */
export const ROTATION_STATUS_FACET_RENDER_BATCH = 500;
