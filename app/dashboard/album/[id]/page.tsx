// Real routable page for /dashboard/album/[id] — makes the URL exist for hard
// navigation, permalinks, and bookmarks. The modal itself renders through the
// @information slot; this page just makes the segment routable (WXYC/dj-site#979).
// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export { default } from "../../@information/(.)album/[id]/page";
