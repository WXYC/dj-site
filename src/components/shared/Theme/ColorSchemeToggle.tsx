"use client";

import { DarkModeRounded, LightModeRounded } from "@mui/icons-material";
import { Tooltip } from "@mui/joy";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import { useGetActiveExperienceQuery } from "@/lib/features/experiences/api";
import {
  buildPreference,
  useThemePreferenceActions,
} from "@/src/hooks/themePreferenceHooks";

export function ColorSchemeToggleLoader(): JSX.Element {
  return (
    <IconButton variant="soft" loading disabled>
      <DarkModeRounded />
    </IconButton>
  );
}

export default function ColorSchemeToggle(): JSX.Element {
  const { mode, setMode } = useColorScheme();
  const { data: experience } = useGetActiveExperienceQuery();
  const { persistPreference } = useThemePreferenceActions();

  return (
    <Tooltip
      title={`Switch to ${mode == "dark" ? "light" : "dark"} mode`}
      size="sm"
      placement="top-start"
      variant="outlined"
    >
      <IconButton
        id="toggle-mode"
        onClick={() => {
          const nextMode = mode === "light" ? "dark" : "light";
          setMode(nextMode);
          if (experience) {
            persistPreference(buildPreference(experience, nextMode), {
              updateUser: true,
            });
          }
        }}
      >
        {mode === "light" ? <DarkModeRounded /> : <LightModeRounded />}
      </IconButton>
    </Tooltip>
  );
}
