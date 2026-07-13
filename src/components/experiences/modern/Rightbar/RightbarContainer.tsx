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
        // Sit on `body` (not the default Sheet `surface`) so the outlined
        // NowPlaying and Mail Bin cards (which use `surface`) read as framed,
        // distinct panels instead of blending into the sidebar.
        backgroundColor: "background.body",
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
        // Pin the trailing spacer to the bottom of the sidebar when the
        // content is shorter than the viewport…
        justifyContent: "space-between",
        // …and let the column scroll when its content (Now Playing + a tall
        // Mail Bin) exceeds it, instead of clipping the overflow off-screen.
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
