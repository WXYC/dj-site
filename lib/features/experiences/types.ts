import { ReactNode } from "react";

/**
 * Available experience identifiers
 */
export type ExperienceId = "classic" | "modern";

/**
 * Supported color scheme modes
 */
export type ColorMode = "light" | "dark";

/**
 * Experience metadata and configuration
 */
export interface ExperienceConfig {
  /** Unique identifier */
  id: ExperienceId;
  
  /** Display name */
  name: string;
  
  /** Brief description */
  description: string;
  
  /** Icon identifier for UI */
  icon: "classic" | "modern";
  
  /** Whether this experience is currently enabled */
  enabled: boolean;
  
  /** CSS class/data attribute value */
  cssIdentifier: string;
  
  /** Feature flags specific to this experience */
  features: {
    hasRightbar: boolean;
    hasLeftbar: boolean;
    hasMobileHeader: boolean;
    supportsThemeToggle: boolean;
  };
}

/**
 * Experience state stored in application
 */
export interface ExperienceState {
  /** Currently active experience */
  active: ExperienceId;
  
  /** Available experiences */
  available: ExperienceId[];
  
  /** Whether user is allowed to switch */
  switchingEnabled: boolean;
}

/**
 * Props for experience-aware layout components
 */
export interface ExperienceLayoutProps {
  children: ReactNode;
  experience: ExperienceId;
}

/**
 * Default experience state
 */
export const defaultExperienceState: ExperienceState = {
  active: "modern",
  available: ["classic", "modern"],
  switchingEnabled: true,
};

/**
 * Type guard to check if a string is a valid ExperienceId
 */
export function isExperienceId(value: unknown): value is ExperienceId {
  return value === "classic" || value === "modern";
}

/**
 * Get experience from string with fallback
 */
export function toExperienceId(value: unknown, fallback: ExperienceId = "modern"): ExperienceId {
  return isExperienceId(value) ? value : fallback;
}

