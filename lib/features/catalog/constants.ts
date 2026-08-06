/** Page size for GET /library/query (must match backend default/limit handling). */
export const CATALOG_QUERY_PAGE_LIMIT = 50;

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
