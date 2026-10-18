import type { JSX } from "react";
import { Box } from "@mui/joy";
import { APPBAR_CLEARANCE_PX } from "@/src/components/shared/Theme/appbarSize";

/** Marks the scroll container, so what must measure it finds it with `closest` rather than by its place in the tree. */
export const SCROLL_REGION_ATTRIBUTE = "data-scroll-region";

// Main is a fixed 100dvh box with overflow:hidden, so a page that owns no
// scroll container has everything past the fold clipped away rather than
// scrolled to. Wrapped around the screen and not the page header, so the header
// stays pinned; `flex` + `minHeight` shrink the pane to the space left below it.
// `clearAppbar` keeps the last row from ending under the fixed Appbar below md.
export default function ScrollRegion({ children, clearAppbar = false }: { children: React.ReactNode; clearAppbar?: boolean }): JSX.Element {
  return (
    <Box
      {...{ [SCROLL_REGION_ATTRIBUTE]: "" }}
      sx={{ flex: 1, minHeight: 0, overflow: "auto", ...(clearAppbar && { pb: { xs: `${APPBAR_CLEARANCE_PX}px`, md: 0 } }) }}
    >
      {children}
    </Box>
  );
}
