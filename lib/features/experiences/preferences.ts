import { ApplicationState } from "@/lib/features/application/types";
import { ColorMode, ExperienceId } from "./types";

export type AppSkinPreference = `${ExperienceId}-${ColorMode}`;

const VALID_PREFERENCES: AppSkinPreference[] = [
  "classic-light",
  "classic-dark",
  "modern-light",
  "modern-dark",
];

export const APP_SKIN_STORAGE_KEY = "wxyc_app_skin";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

export function isAppSkinPreference(value: unknown): value is AppSkinPreference {
  return typeof value === "string" && VALID_PREFERENCES.includes(value as AppSkinPreference);
}

export function toAppSkinPreference(
  experience: ExperienceId,
  colorMode: ColorMode
): AppSkinPreference {
  return `${experience}-${colorMode}`;
}

export function parseAppSkinPreference(value: unknown): {
  experience: ExperienceId;
  colorMode: ColorMode;
} | null {
  if (!isAppSkinPreference(value)) return null;
  const [experience, colorMode] = value.split("-") as [ExperienceId, ColorMode];
  return { experience, colorMode };
}

export function getPreferenceFromAppState(
  appState?: ApplicationState | null
): AppSkinPreference | null {
  if (!appState) return null;
  return toAppSkinPreference(appState.experience, appState.colorMode);
}
