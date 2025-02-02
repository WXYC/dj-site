"use client";
import { closeSidebarCSS } from "@/src/utilities/modern/catalog/utilities";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { Box } from "@mui/joy";

export default function RightbarMobileClose() {
  const dispatch = useAppDispatch();
  const closeSidebar = () => {
    dispatch(applicationSlice.actions.closeSidebar());
    closeSidebarCSS();
  }

  return (
    <Box
      className="SecondSidebar-overlay"
      sx={{
        position: "fixed",
        zIndex: 9998,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        bgcolor: "background.body",
        opacity: "calc(var(--SideNavigation-slideIn, 0) - 0.2)",
        transition: "opacity 0.4s",
        transform: {
          xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1) + var(--SideNavigation-slideIn, 0) * var(--FirstSidebar-width, 0px)))",
          md: "translateX(-100%)",
        },
      }}
      onClick={closeSidebar}
    />
  );
}
