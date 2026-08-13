/**
 * True when `album_id` carries a real server-issued id, not a client-side
 * placeholder. Positive does not always mean `library.id` — LML rows carry a
 * positive `legacy_release_id` instead — so callers must not assume a
 * specific id space, only that the row is genuinely linked to something the
 * server knows about. `undefined` means freeform; negative ids are
 * synthesized client-side for library-unlinked rows (`synthesizeAlbumId` in
 * catalog/conversions) and are rejected by endpoints that validate a
 * positive-integer id boundary. Callers gate the linked-album submission
 * shape on this — previously five files re-derived the check locally.
 */
export function hasLinkedAlbumId(albumId: unknown): albumId is number {
  return typeof albumId === "number" && albumId > 0;
}
