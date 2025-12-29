"use client";

import { Box } from "@mui/joy";


export default function Footer() {
  return (
    <Box
      component="footer"
      sx = {{
        display: "flex",
        justifyContent: "center",
        py: 3,
      }}
    >
      Copyright © {new Date().getFullYear()} WXYC Chapel Hill
    </Box>
  );
}
