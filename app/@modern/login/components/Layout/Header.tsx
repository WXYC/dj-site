"use client";

import Logo from "@/app/components/Branding/Logo";
import { Box } from "@mui/joy";
import dynamic from "next/dynamic";

const ColorSchemeToggle = dynamic(() => import("@/app/components/Theme/ColorSchemeToggle").then(mod => mod.default), {
    ssr: false,
});

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
