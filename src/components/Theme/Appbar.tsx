"use client";

import { ColorSchemeToggleLoader } from "@/src/components/Theme/ColorSchemeToggle";
import { usePublicRoutes } from "@/src/hooks/applicationHooks";
import { Box, Button, ButtonGroup, Typography } from "@mui/joy";
import dynamic from "next/dynamic";
import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";

const ColorSchemeToggle = dynamic(
  () =>
    import("@/src/components/Theme/ColorSchemeToggle").then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <ColorSchemeToggleLoader />,
  }
);

export default function Appbar() {
  const isPublic = usePublicRoutes();

  return (
    <Box
      className="ignoreClassic"
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
        {isPublic ? (
          <Link href="/login">
            <Button variant="soft">Log In</Button>
          </Link>
        ) : (
          <>
            <Link href="https://forms.gle/9q1mGCFtPS7DXQUE9" target="_blank">
              <Button variant="soft">Beta Tester Form</Button>
            </Link>
            <Link href="https://forms.gle/VCw43XejNte27Bef7" target="_blank">
              <Button variant="soft">General Feedback</Button>
            </Link>
          </>
        )}
        <ThemeSwitcher />
        <ColorSchemeToggle />
      </ButtonGroup>
    </Box>
  );
}
