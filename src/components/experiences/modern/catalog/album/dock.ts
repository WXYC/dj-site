// The docked panel / pinned rail only exist where the rightbar is an in-flow
// flex sibling. Below Joy's md breakpoint the rightbar is an off-canvas
// drawer, so the card must stay a (fullscreen) modal and pinning is hidden.
export const ALBUM_DOCK_QUERY = "(min-width: 900px)";

export const DOCK_PANEL_WIDTH = "clamp(380px, 30vw, 420px)";

// The home panel hosts the Bin card, whose width is viewport-responsive
// (400px at lg), so it mirrors the full rightbar's widths instead of the
// album panel's clamp.
export const HOME_PANEL_WIDTH = { md: 350, lg: 450 } as const;

// Panel headers and the rail's home-button area share one height so their
// bottom dividers form a single line across the panel/rail seam.
export const DOCK_HEADER_HEIGHT = 56;

// The viewport-fixed footer buttons (feedback, theme switcher) float over the
// rightbar's bottom edge; every right-side surface reserves this clearance.
export const RIGHTBAR_FOOTER_CLEARANCE = 65;
