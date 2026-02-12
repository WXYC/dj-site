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
          height: "clamp(2rem, 10vw, 7rem)",
        }}
      >
        <Logo />
      </Box>
      <Box>
      </Box>
    </Box>
  );
}
