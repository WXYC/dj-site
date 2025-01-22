import { Box } from "@mui/joy";
import React from "react";
import DesktopHeader from "./components/Header/DesktopHeader";
import MobileHeader from "./components/Header/MobileHeader";
import Leftbar from "./components/Leftbar/Leftbar";
import Main from "./components/Main";
import Rightbar from "./components/Rightbar/Rightbar";

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
      <Rightbar />
    </Box>
  );
}
