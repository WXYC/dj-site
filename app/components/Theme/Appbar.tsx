"use client";

import { Box, Button, ButtonGroup } from "@mui/joy";
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
      }}
    >
      <ButtonGroup variant="solid" size="sm" color="warning">
        <Link href="https://www.google.com" target="_blank">
          <Button variant="soft">Feedback</Button>
        </Link>
        <ThemeSwitcher />
        <ColorSchemeToggle />
      </ButtonGroup>
    </Box>
  );
}
