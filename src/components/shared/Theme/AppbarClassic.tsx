"use client";

import { ColorSchemeToggleLoader } from "@/src/components/shared/Theme/ColorSchemeToggle";
import { ExperienceId } from "@/lib/features/experiences/types";
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

export default function AppbarClassic({
  experience,
}: {
  experience: ExperienceId;
}) {
  const isPublic = usePublicRoutes();

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 5,
        right: 5,
        zIndex: 10000,
        // Right-justify the whole footer so a long version string can't shove
        // the button row leftward (matches the modern Appbar).
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      <Typography level="body-xs" variant="plain" sx={{ textAlign: "right" }}>
        WXYC DJ Site v{process.env.NEXT_PUBLIC_VERSION}
      </Typography>
      <ButtonGroup variant="solid" size="sm" color="neutral">
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
        <ThemeSwitcher experience={experience} />
        <ColorSchemeToggle experience={experience} />
      </ButtonGroup>
    </Box>
  );
}
