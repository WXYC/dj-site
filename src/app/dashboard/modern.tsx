import { Box } from "@mui/joy";
import React from "react";
import DesktopHeader from "../components/Header/Modern/DesktopHeader";
import MobileHeader from "../components/Header/Modern/MobileHeader";
import Leftbar from "../components/Leftbar/Leftbar";
import Main from "../components/Main/Main";

export default function ModernDashboard({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <MobileHeader />
      <Leftbar />
      <Main>
        <DesktopHeader />
        {children}
      </Main>
    </Box>
  );
}
