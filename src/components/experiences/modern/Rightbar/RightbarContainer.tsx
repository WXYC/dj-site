import { Sheet } from "@mui/joy";
import type { ReactNode } from "react";

export default function RightbarContainer({
  children,
  variant = "full",
}: {
  children: ReactNode;
  // "rail" narrows the sidebar to the pinned-album strip at the dock
  // breakpoint; below md the drawer keeps its full width regardless.
  variant?: "full" | "rail";
}) {
  const width =
    variant === "rail"
      ? { xs: "100%" as const, sm: 350, md: 68 }
      : { xs: "100%" as const, sm: 350, lg: 450 };

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
        width,
        maxWidth: width,
        minWidth: 0,
      }}
    >
      {children}
    </Sheet>
  );
}
