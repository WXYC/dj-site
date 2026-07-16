"use client";

import Logo from "@/src/components/shared/Branding/Logo";
import { Box } from "@mui/joy";

export default function Header() {
  return (
    <Box
      component="header"
      sx={{
        py: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box
        sx={{
          width: 150,
          mx: "auto",
        }}
      >
        <Logo />
      </Box>
    </Box>
  );
}
