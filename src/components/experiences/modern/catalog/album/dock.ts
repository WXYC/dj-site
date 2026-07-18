// The docked card / pinned rail only exist where the rightbar is an in-flow
// flex sibling. Below Joy's md breakpoint the rightbar is an off-canvas
// drawer, so the card must stay a (fullscreen) modal and pinning is hidden.
export const ALBUM_DOCK_QUERY = "(min-width: 900px)";
