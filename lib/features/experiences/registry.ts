import { ExperienceConfig, ExperienceId } from "./types";

export const EXPERIENCE_REGISTRY: Record<ExperienceId, ExperienceConfig> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Original WXYC interface with legacy styling",
    icon: "classic",
    enabled: true,
    cssIdentifier: "classic",
    features: {
      hasRightbar: false,
      hasLeftbar: false,
      hasMobileHeader: false,
      supportsThemeToggle: false,
      supportsThemePicker: false,
    },
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Contemporary interface with enhanced features",
    icon: "modern",
    enabled: true,
    cssIdentifier: "modern",
    features: {
      hasRightbar: true,
      hasLeftbar: true,
      hasMobileHeader: true,
      supportsThemeToggle: true,
      supportsThemePicker: true,
    },
  },
};

export function getExperienceConfig(id: ExperienceId): ExperienceConfig {
  return EXPERIENCE_REGISTRY[id];
}

export function getEnabledExperiences(): ExperienceConfig[] {
  return Object.values(EXPERIENCE_REGISTRY).filter((exp) => exp.enabled);
}

export function isExperienceEnabled(id: ExperienceId): boolean {
  return EXPERIENCE_REGISTRY[id]?.enabled ?? false;
}

export function getDefaultExperience(): ExperienceId {
  const envDefault = process.env.NEXT_PUBLIC_DEFAULT_EXPERIENCE;
  if (envDefault === "classic" || envDefault === "modern") {
    return envDefault;
  }
  return "modern";
}

export function getAllowedExperiences(): ExperienceId[] {
  const envAllowed = process.env.NEXT_PUBLIC_ENABLED_EXPERIENCES;
  if (envAllowed) {
    const experiences = envAllowed.split(",").map((e) => e.trim());
    return experiences.filter(
      (e): e is ExperienceId => e === "classic" || e === "modern"
    );
  }
  return ["classic", "modern"];
}

export function isExperienceSwitchingAllowed(): boolean {
  const envValue = process.env.NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING;
  if (envValue === "false" || envValue === "0") {
    return false;
  }
  return true;
}

