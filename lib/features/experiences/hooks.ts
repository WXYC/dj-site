"use client";

import { useAppSelector } from "@/lib/hooks";
import { useMemo } from "react";
import { getExperienceConfig } from "./registry";
import { ExperienceConfig, ExperienceId } from "./types";

/**
 * Hook to get the current active experience ID
 */
export function useActiveExperience(): ExperienceId {
  // This will read from the application state once we update it
  // For now, we'll add a fallback
  const experience = useAppSelector((state) => {
    // Check if the new structure exists
    if ("experience" in state.application && typeof state.application.experience === "string") {
      return state.application.experience as ExperienceId;
    }
    // Fall back to old 'classic' boolean
    if ("classic" in state.application) {
      return (state.application as any).classic ? "classic" : "modern";
    }
    return "modern";
  });
  
  return experience;
}

/**
 * Hook to get the current experience configuration
 */
export function useExperienceConfig(): ExperienceConfig {
  const experienceId = useActiveExperience();
  return useMemo(() => getExperienceConfig(experienceId), [experienceId]);
}

/**
 * Hook to check if a specific experience is active
 */
export function useIsExperience(id: ExperienceId): boolean {
  const active = useActiveExperience();
  return active === id;
}

/**
 * Hook to get experience-specific feature flags
 */
export function useExperienceFeatures() {
  const config = useExperienceConfig();
  return config.features;
}

