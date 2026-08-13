/** Page size for GET /library/query (must match backend default/limit handling). */
export const CATALOG_QUERY_PAGE_LIMIT = 50;

/**
 * Hard ceiling GET /library/query enforces on `limit` (its `MAX_LIMIT`): a
 * larger value is rejected with a 400, not clamped down. One request can
 * therefore never return more than this many rows, so a screen that wants a
 * whole result set in a single request has to treat this as the cap and tell
 * the reader whenever the reported `total` exceeds what it received.
 */
export const CATALOG_QUERY_MAX_LIMIT = 100;

/** Server CHECK constraint cap on library.discogs_unavailable_note (varchar(500)). */
export const DISCOGS_UNAVAILABLE_NOTE_MAX_LENGTH = 500;

/**
 * `library.album_title`, `library.alternate_artist_name`, and `library.label`
 * are all `varchar(128)`. PATCH /library/:id rejects longer values with a 400,
 * so an edit UI must cap them client-side rather than let the round trip fail.
 */
export const ALBUM_TEXT_MAX_LENGTH = 128;

/** PATCH /library/:id requires disc_quantity to be an integer in this range. */
export const DISC_QUANTITY_MIN = 1;
export const DISC_QUANTITY_MAX = 99;
