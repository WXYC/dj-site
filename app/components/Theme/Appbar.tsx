"use client";

import { Box, Button, ButtonGroup, Typography } from "@mui/joy";
import dynamic from "next/dynamic";
import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";

const ColorSchemeToggle = dynamic(
  () =>
    import("@/app/components/Theme/ColorSchemeToggle").then(
      (mod) => mod.default
    ),
  {
    ssr: false,
  }
);

export default function Appbar() {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 5,
        right: 5,
        zIndex: 10000,
      }}
    >
      <Typography level="body-xs" variant="plain" sx={{ textAlign: "right" }}>
        WXYC DJ Site v{process.env.NEXT_PUBLIC_VERSION}
      </Typography>
      <ButtonGroup variant="solid" size="sm" color="success">
        <Link href="https://forms.gle/VCw43XejNte27Bef7" target="_blank">
          <Button variant="soft">Feedback</Button>
        </Link>
        <ThemeSwitcher />
        <ColorSchemeToggle />
      </ButtonGroup>
    </Box>
  );
}
