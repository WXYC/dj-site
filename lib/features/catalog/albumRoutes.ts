// Album detail is a nested route segment under each dashboard page
// (/dashboard/<page>/album/<id>), so the permalink encodes which page renders
// behind the card. These helpers are the single owners of that URL shape.

const ALBUM_SEGMENT = /\/album\/(\d+)\/?$/;

// Pages that host an album/[id] child route. The bin can open a card from
// anywhere (it lives in the rightbar), so hrefs built from a non-hosting
// pathname must fall back to the catalog rather than produce a 404.
const ALBUM_HOST_PAGES: readonly string[] = [
  "/dashboard/catalog",
  "/dashboard/flowsheet",
  "/dashboard/playlists",
  "/dashboard/admin/roster",
];

/** The pathname with any trailing /album/<id> segment removed. */
export function albumParentPath(pathname: string): string {
  const stripped = pathname.replace(ALBUM_SEGMENT, "").replace(/\/+$/, "");
  return stripped || "/dashboard";
}

/** Href that opens `albumId`'s card over the page the DJ is currently on. */
export function albumDetailHref(pathname: string, albumId: number): string {
  const base = albumParentPath(pathname);
  const host = ALBUM_HOST_PAGES.includes(base) ? base : "/dashboard/catalog";
  return `${host}/album/${albumId}`;
}

/** The open card's album id, or null when the pathname has no album segment. */
export function parseAlbumIdFromPathname(pathname: string): number | null {
  const match = pathname.match(ALBUM_SEGMENT);
  return match ? Number(match[1]) : null;
}
