import type { JSX } from "react";
import { Box } from "@mui/joy";

// Main is a fixed 100dvh box with overflow:hidden, so a page that owns no
// scroll container has everything past the fold clipped away rather than
// scrolled to. Wrapped around the screen and not the page header, so the header
// stays pinned; `flex` + `minHeight` shrink the pane to the space left below it.
export default function ReviewScrollRegion({ children }: { children: React.ReactNode }): JSX.Element {
  return <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</Box>;
}
