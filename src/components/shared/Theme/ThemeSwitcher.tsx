"use client";

import { IconButton, Tooltip } from "@mui/joy";
import React from "react";

import { useRouter } from "next/navigation";

import { AutoFixHigh, AutoFixOff } from "@mui/icons-material";
import {
  useGetActiveExperienceQuery,
} from "@/lib/features/experiences/api";
import { useColorScheme } from "@mui/joy/styles";
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
  const router = useRouter();

  const { data: experience, isLoading } = useGetActiveExperienceQuery();
  const { mode } = useColorScheme();
  const { persistPreference } = useThemePreferenceActions();

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const newExperience = experience === "classic" ? "modern" : "classic";
    const nextMode = mode ?? "light";
    await persistPreference(buildPreference(newExperience, nextMode), {
      updateUser: true,
    });
    router.refresh();
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
