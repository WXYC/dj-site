import { Sheet } from "@mui/joy";
import React from "react";

export default function RightbarContainer({
  children,
}: {
  children: React.ReactNode;
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
        zIndex: 9999,
        height: "100dvh",
        top: 0,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
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
