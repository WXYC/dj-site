"use client";
import { Box } from "@mui/joy";
import React from "react";

export default function Main({ children }: { children: React.ReactNode }) {
  return (
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
        overflow: "hidden",
        gap: 1,
      })}
    >
      {children}
    </Box>
  );
}
