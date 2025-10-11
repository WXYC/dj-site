"use client";

import { IconButton, Tooltip } from "@mui/joy";
import React from "react";

import { useRouter } from "next/navigation";

import { AutoFixHigh, AutoFixOff } from "@mui/icons-material";
import { useEffect } from "react";
import {
  useGetActiveExperienceQuery,
  useSwitchExperienceMutation,
} from "@/lib/features/experiences/api";

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
  const [switchExperience, result] = useSwitchExperienceMutation();

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const newExperience = experience === "classic" ? "modern" : "classic";
    switchExperience(newExperience);
  };
  
  useEffect(() => {
    if (result.isSuccess) {
      router.refresh();
    }
  }, [result.isSuccess, router]);

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
