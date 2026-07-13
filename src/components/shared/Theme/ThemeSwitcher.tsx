"use client";

import { IconButton, Tooltip } from "@mui/joy";
import type { MouseEvent as ReactMouseEvent } from "react";

import { AutoFixHigh, AutoFixOff } from "@mui/icons-material";
import {
  useGetActiveExperienceQuery,
} from "@/lib/features/experiences/api";
import { useColorScheme } from "@mui/joy/styles";
import { useModernTheme } from "@/src/styles/ModernThemeContext";
import {
  buildPreference,
  useThemePreferenceActions,
} from "@/src/hooks/themePreferenceHooks";

export function ThemeSwitchLoader() {
  return (
    <IconButton variant="soft" loading disabled>
      <AutoFixHigh />
    </IconButton>
  );
}

export default function ThemeSwitcher() {
  const { data: experience, isLoading } = useGetActiveExperienceQuery();
  const { mode } = useColorScheme();
  const { themeId } = useModernTheme();
  const { persistPreference } = useThemePreferenceActions();

  const handleSwitch = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const newExperience = experience === "classic" ? "modern" : "classic";
    const nextMode = mode === "light" || mode === "dark" ? mode : "light";
    const persisted = await persistPreference(
      buildPreference(newExperience, nextMode, themeId),
      { updateUser: true }
    );
    // Full reload, not router.refresh(): the experience decides which Joy
    // theme CssVarsProvider gets, and the provider doesn't regenerate its
    // injected :root vars on a soft refresh (see ThemePicker). Skip when the
    // cookie didn't persist — SSR would just repaint the old experience.
    if (persisted && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const isClassic = experience === "classic";

  return (
    <Tooltip
      title={`Switch to ${isClassic ? "modern" : "classic"} experience`}
      size="sm"
      placement="top-start"
      variant="outlined"
    >
      <IconButton 
        id="toggle-experience" 
        onClick={handleSwitch} 
        loading={isLoading} 
        disabled={isLoading}
      >
        {isClassic ? <AutoFixHigh /> : <AutoFixOff />}
      </IconButton>
    </Tooltip>
  );
}
