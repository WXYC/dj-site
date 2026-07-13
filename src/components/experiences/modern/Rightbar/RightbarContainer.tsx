import { Sheet } from "@mui/joy";
import type { ReactNode } from "react";

export default function RightbarContainer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Sheet
      className="SecondSidebar"
      sx={{
        position: {
          xs: "fixed",
          md: "sticky",
        },
        transform: {
          xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))",
          md: "none",
        },
        borderLeft: "1px solid",
        borderColor: "divider",
        transition: "transform 0.4s, width 0.4s",
        zIndex: { xs: 9999, md: "auto" },
        height: "100dvh",
        top: 0,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        // The Mail Bin flex-grows to absorb the leftover column height and
        // scrolls internally (see BinContent), so the default content fills the
        // viewport exactly — the trailing footer spacer stays pinned to the
        // bottom without needing justify-content. overflowY stays `auto` as a
        // fallback: the alternate panels (settings, album detail) render here
        // too and can legitimately exceed the viewport, and a genuinely short
        // screen should scroll rather than clip.
        overflowY: "auto",
        minHeight: 0,
        gap: 1,
        width: { xs: "100%", sm: 350, lg: 450 },
        maxWidth: { xs: "100%", sm: 350, lg: 450 },
        minWidth: 0,
      }}
    >
      {children}
    </Sheet>
  );
}
