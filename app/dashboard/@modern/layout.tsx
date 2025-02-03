import { Box } from "@mui/joy";
import React from "react";
import Main from "@/src/components/modern/Main";
import Rightbar from "@/src/components/modern/Rightbar/Rightbar";
import MobileHeader from "@/src/components/modern/Header/MobileHeader";
import DesktopHeader from "@/src/components/modern/Header/DesktopHeader";
import Leftbar from "@/src/components/modern/Leftbar/Leftbar";

export default function ModernDashboard({
  children,
}: {
  information: React.ReactNode;
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
