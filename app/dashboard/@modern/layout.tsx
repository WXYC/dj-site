import { Box } from "@mui/joy";
import React from "react";
import Main from "@/src/components/experiences/modern/Main";
import Rightbar from "@/src/components/experiences/modern/Rightbar/Rightbar";
import MobileHeader from "@/src/components/experiences/modern/Header/MobileHeader";
import DesktopHeader from "@/src/components/experiences/modern/Header/DesktopHeader";
import Leftbar from "@/src/components/experiences/modern/Leftbar/Leftbar";
import CatalogPathModals from "@/src/components/experiences/modern/catalog/CatalogPathModals";

export default function ModernDashboard({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Box sx={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
      <CatalogPathModals />
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
