"use client";

import { Box, Typography } from "@mui/joy";
import type { ReactNode } from "react";

type CatalogFilterSectionProps = {
  label?: string;
  children: ReactNode;
};

export function CatalogFilterSection({ label, children }: CatalogFilterSectionProps) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
        px: 0.25,
        py: 0.125,
      }}
    >
      {label ? (
        <Typography
          level="body-xs"
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "text.tertiary",
            mb: 0.125,
            lineHeight: 1,
          }}
        >
          {label}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.375,
          width: "100%",
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
