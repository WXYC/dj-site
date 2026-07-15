/**
 * True when `album_id` is a real library link: a positive DB id.
 * `undefined` means freeform; negative ids are synthesized client-side for
 * library-unlinked rows (`synthesizeAlbumId` in catalog/conversions), and
 * BS's album lookup throws on them (#701). Callers gate the linked-album
 * submission shape on this — previously five files re-derived the check
 * locally (#607/#608/#701/#702 lineage).
 */
export function hasLinkedAlbumId(albumId: unknown): albumId is number {
  return typeof albumId === "number" && albumId > 0;
}
