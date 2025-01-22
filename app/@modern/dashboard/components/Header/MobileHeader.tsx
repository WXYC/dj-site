"use client";

import Logo from "@/app/components/Branding/Logo";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import { useAppDispatch } from "@/lib/hooks";
import { applicationSlice } from "@/lib/features/application/slice";
import { toggleSidebarCSS } from "../../utilities";

export default function MobileHeader(): JSX.Element {

  const dispatch = useAppDispatch();
  const toggleSidebar = () => {
    dispatch(applicationSlice.actions.toggleSidebar());
    toggleSidebarCSS();
  };

  return (
    <Sheet
      sx={{
        display: { xs: "flex", md: "none" },
        justifyContent: "space-between",
        alignItems: "center",
        position: "fixed",
        top: 0,
        width: "100vw",
        height: "var(--Header-height)",
        zIndex: 9995,
        py: 1,
        px: 2,
        gap: 1,
        boxShadow: "sm",
      }}
    >
      <IconButton
        onClick={toggleSidebar}
        variant="outlined"
        color="neutral"
        size="sm"
      >
        <DragHandleIcon />
      </IconButton>
      <Box
        sx={(theme) => ({
          height: "100%",
        })}
      >
        <Logo />
      </Box>
      <Box></Box>
    </Sheet>
  );
}
