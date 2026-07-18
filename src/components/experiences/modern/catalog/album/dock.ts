// The docked panel / pinned rail only exist where the rightbar is an in-flow
// flex sibling. Below Joy's md breakpoint the rightbar is an off-canvas
// drawer, so the card must stay a (fullscreen) modal and pinning is hidden.
export const ALBUM_DOCK_QUERY = "(min-width: 900px)";

// One width for every docked pane (home and album): contents size to their
// container, so pane switches never resize the panel.
export const DOCK_PANEL_WIDTH = "clamp(380px, 30vw, 420px)";

// Panel headers and the rail's home-button area share one height so their
// bottom dividers form a single line across the panel/rail seam.
export const DOCK_HEADER_HEIGHT = 56;

// The viewport-fixed footer buttons (feedback, theme switcher) float over the
// rightbar's bottom edge; every right-side surface reserves this clearance.
export const RIGHTBAR_FOOTER_CLEARANCE = 65;
