"use client";

import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { usePathname } from "next/navigation";

import type { ColorMode } from "@/lib/features/experiences/types";
import { useExperienceSwitch } from "@/src/hooks/experienceSwitchHooks";

type ExperienceGapProps = {
  colorMode: ColorMode;
  themeId?: string;
};

/**
 * Rendered by the modern slot at URLs only the classic experience implements —
 * the librarian card-catalog and rotation screens, which are classic-first.
 *
 * Without it the modern slot falls through to a `null` default, which paints
 * the modern chrome around an empty content area and reads as a broken page.
 */
export default function ExperienceGap({
  colorMode,
  themeId,
}: ExperienceGapProps) {
  const pathname = usePathname();
  const { switchExperience, pending } = useExperienceSwitch({
    target: "classic",
    colorMode,
    themeId,
  });

  return (
    <Sheet
      variant="soft"
      sx={{ borderRadius: "md", p: 3, m: "auto", maxWidth: 520 }}
    >
      <Stack spacing={2} alignItems="flex-start">
        <Typography level="title-lg">
          This page is only in the classic interface
        </Typography>
        <Typography level="body-md">
          {pathname ? <code>{pathname}</code> : "This page"} has no modern
          version yet. Switching will reload the site in the classic interface;
          you can switch back from the wand button at the bottom of any page.
        </Typography>
        <Button onClick={switchExperience} loading={pending}>
          Switch to the classic interface
        </Button>
      </Stack>
    </Sheet>
  );
}
