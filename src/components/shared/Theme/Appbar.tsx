"use client";

import { ColorSchemeToggleLoader } from "@/src/components/shared/Theme/ColorSchemeToggle";
import { ExperienceId } from "@/lib/features/experiences/types";
import { usePublicRoutes } from "@/src/hooks/applicationHooks";
import { Box, ButtonGroup, Typography } from "@mui/joy";
import dynamic from "next/dynamic";
import { LinkButton } from "../General/LinkButton";
import ThemePicker from "./ThemePicker";
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

export default function Appbar({ experience }: { experience: ExperienceId }) {
  const isPublic = usePublicRoutes();

  return (
    <Box
      className="ignoreClassic"
      sx={{
        position: "fixed",
        bottom: 5,
        right: 5,
        zIndex: 10000,
        // Right-justify the whole footer: a long version string used to widen
        // the box and shove the button row leftward. Anchoring both the text
        // and the button group to the right edge keeps them lined up.
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      <Typography level="body-xs" variant="plain" sx={{ textAlign: "right" }}>
        WXYC DJ Site v{process.env.NEXT_PUBLIC_VERSION}
      </Typography>
      <ButtonGroup variant="solid" size="sm" color="success">
        {isPublic && <LinkButton href="/login">Log In</LinkButton>}
        {!isPublic && (
          <LinkButton
            href="https://forms.gle/VCw43XejNte27Bef7"
            target="_blank"
            variant="soft"
          >
            General Feedback
          </LinkButton>
        )}
        {/* Classic-mode switcher sits left of the color-theme picker. The
            picker is intentionally absent from AppbarClassic, so it is
            unavailable once classic mode is enabled. */}
        <ThemeSwitcher experience={experience} />
        <ThemePicker />
        <ColorSchemeToggle experience={experience} />
      </ButtonGroup>
    </Box>
  );
}
