"use client";

import { ColorSchemeToggleLoader } from "@/src/components/shared/Theme/ColorSchemeToggle";
import { ExperienceId } from "@/lib/features/experiences/types";
import { usePublicRoutes } from "@/src/hooks/usePublicRoutes";
import { Box, ButtonGroup } from "@mui/joy";
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

/** The fixed Appbar's gap from the viewport's bottom and right edges, in px. */
export const APPBAR_OFFSET_PX = 5;
/** Its height in px, set on the box itself: a size-sm button group (2rem = 32). */
export const APPBAR_HEIGHT_PX = 32;
/** How far above the viewport's bottom its top edge sits; content that must stay clear of it needs this much room below. */
export const APPBAR_CLEARANCE_PX = APPBAR_OFFSET_PX + APPBAR_HEIGHT_PX;

export default function Appbar({ experience }: { experience: ExperienceId }) {
  const isPublic = usePublicRoutes();

  return (
    <Box
      className="ignoreClassic"
      sx={{
        position: "fixed",
        bottom: APPBAR_OFFSET_PX,
        right: APPBAR_OFFSET_PX,
        zIndex: 10000,
        boxSizing: "border-box",
        minHeight: APPBAR_HEIGHT_PX,
      }}
    >
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
