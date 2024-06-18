"use client";
import {
  getAuthenticatedUser,
  getClassicViewAvailable,
  useDispatch,
  useSelector,
} from "@/lib/redux";
import Box from "@mui/joy/Box";
import React, { useEffect } from "react";
import FirstSidebar from "../components/Dashboard/FirstSidebar";
import Header from "../components/Dashboard/Header";
import SecondSidebar from "../components/Dashboard/SecondSidebar";
import { ColorSchemeToggle } from "../components/General/Theme/ColorSchemeToggle";
import { ViewStyleToggle } from "../components/General/Theme/ViewStyleToggle";

export default function DashboardContent(
  props: React.PropsWithChildren
): JSX.Element {
  const dispatch = useDispatch();
  const classicViewAvailable = useSelector(getClassicViewAvailable);

  const user = useSelector(getAuthenticatedUser);

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Header altViewAvailable={classicViewAvailable} />
      <FirstSidebar />
      <Box
        component="main"
        className="MainContent"
        sx={(theme) => ({
          px: {
            xs: 2,
            md: 6,
          },
          pt: {
            xs: `calc(${theme.spacing(2)} + var(--Header-height))`,
            sm: `calc(${theme.spacing(2)} + var(--Header-height))`,
            md: 3,
          },
          pb: {
            xs: 2,
            sm: 2,
            md: 3,
          },
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100dvh",
          gap: 1,
        })}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box sx={{ ml: "auto", display: { xs: "none", md: "inline-flex" } }}>
            <ColorSchemeToggle />
            <ViewStyleToggle />
          </Box>
        </Box>
        {props.children}
      </Box>
      <SecondSidebar />
    </Box>
  );
}
