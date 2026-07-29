// Real routable page for /dashboard/album/[id] — makes the URL exist for hard
// navigation, permalinks, and bookmarks. The modal itself renders through the
// @information slot; this page just makes the segment routable (WXYC/dj-site#979).
export { default } from "../../@information/(.)album/[id]/page";
