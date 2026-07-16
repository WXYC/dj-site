import { ComponentType, ReactNode } from "react";

export type ExperienceId = "classic" | "modern";

export type ColorMode = "light" | "dark";

export interface ExperienceConfig {
  id: ExperienceId;
  name: string;
  description: string;
  icon: "classic" | "modern";
  enabled: boolean;
  cssIdentifier: string;
  features: {
    hasRightbar: boolean;
    hasLeftbar: boolean;
    hasMobileHeader: boolean;
    supportsThemeToggle: boolean;
    supportsThemePicker: boolean;
  };
}

export interface ExperienceState {
  active: ExperienceId;
  available: ExperienceId[];
  switchingEnabled: boolean;
}

export interface ExperienceLayoutProps {
  children: ReactNode;
  experience: ExperienceId;
}

export const defaultExperienceState: ExperienceState = {
  active: "modern",
  available: ["classic", "modern"],
  switchingEnabled: true,
};

export function isExperienceId(value: unknown): value is ExperienceId {
  return value === "classic" || value === "modern";
}

export function toExperienceId(value: unknown, fallback: ExperienceId = "modern"): ExperienceId {
  return isExperienceId(value) ? value : fallback;
}
