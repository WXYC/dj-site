"use client";

import { Box } from "@mui/joy";

export default function Main({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        my: "auto",
        py: 2,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: 400,
        maxWidth: "100%",
        mx: "auto",
        borderRadius: "sm",
        "& form": {
          display: "flex",
          flexDirection: "column",
          gap: 2,
        },
      }}
    >
      {children}
    </Box>
  );
}
