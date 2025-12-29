"use client";

import { ColorSchemeToggleLoader } from "@/src/components/shared/Theme/ColorSchemeToggle";
import { usePublicRoutes } from "@/src/hooks/applicationHooks";
import { Box, ButtonGroup, Typography } from "@mui/joy";
import dynamic from "next/dynamic";
import { LinkButton } from "../General/LinkButton";
import ThemeSwitcher from "./ThemeSwitcher";

const ColorSchemeToggle = dynamic(
  () =>
    import("@/src/components/shared/Theme/ColorSchemeToggle").then(
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
        position: "fixed",
        bottom: 5,
        right: 5,
        zIndex: 10000,
      }}
    >
      <Typography level="body-xs" variant="plain" sx={{ textAlign: "right" }}>
        WXYC DJ Site v{process.env.NEXT_PUBLIC_VERSION}
      </Typography>
      <ButtonGroup variant="solid" size="sm" color="success">
        {isPublic && <LinkButton href="/login">Log In</LinkButton>}
        {!isPublic && (
          <LinkButton
            href="https://forms.gle/9q1mGCFtPS7DXQUE9"
            target="_blank"
            variant="soft"
          >
            Beta Tester Form
          </LinkButton>
        )}
        {!isPublic && (
          <LinkButton
            href="https://forms.gle/VCw43XejNte27Bef7"
            target="_blank"
            variant="soft"
          >
            General Feedback
          </LinkButton>
        )}
        <ThemeSwitcher />
        <ColorSchemeToggle />
      </ButtonGroup>
    </Box>
  );
}
