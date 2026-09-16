// Routability stub for /dashboard/album/legacy/[legacyId]. The dashboard layout
// renders the @information / @modern / @classic parallel slots but not the
// `children` slot, so this page's output is never displayed; it exists only so
// the segment resolves instead of 404-ing. The legacy->serial resolve, the
// redirect, and the not-found state all render through the @information slot
// sibling.
// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export default function LegacyAlbumPermalinkRoutable() {
  return null;
}
