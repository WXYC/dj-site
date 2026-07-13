import { ApplicationState } from "@/lib/features/application/types";
import { ColorMode, ExperienceId } from "./types";
import {
  DEFAULT_MODERN_THEME_ID,
  THEME_ID_PATTERN,
} from "./modern/themes/registry";

/**
 * App-skin preference grammar (persisted in localStorage, the `app_state` cookie,
 * and the better-auth `appSkin` field):
 *
 *   classic-<mode>              e.g. "classic-light"          (no theme axis)
 *   modern-<mode>               e.g. "modern-dark"            (legacy → theme "default")
 *   modern-<themeId>-<mode>     e.g. "modern-solar-light"
 *
 * Theme ids are dash-free (`^[a-z0-9]+$`), so parsing splits on "-": the first
 * token is the experience, the last is the mode, and an optional middle token is
 * the theme id. The default theme is emitted in the legacy 2-part form so older
 * clients (whose validators predate the theme axis) keep working.
 */
export type AppSkinPreference =
  | `${ExperienceId}-${ColorMode}`
  | `modern-${string}-${ColorMode}`;

export const APP_SKIN_STORAGE_KEY = "wxyc_app_skin";

export interface ParsedAppSkin {
  experience: ExperienceId;
  colorMode: ColorMode;
  /** Always resolved (defaults to `DEFAULT_MODERN_THEME_ID` for classic/legacy). */
  themeId: string;
}

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

function isExperience(value: unknown): value is ExperienceId {
  return value === "classic" || value === "modern";
}

export function parseAppSkinPreference(value: unknown): ParsedAppSkin | null {
  if (typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length < 2 || parts.length > 3) return null;

  const experience = parts[0];
  const colorMode = parts[parts.length - 1];
  if (!isExperience(experience) || !isColorMode(colorMode)) return null;

  let themeId = DEFAULT_MODERN_THEME_ID;
  if (parts.length === 3) {
    // Theme axis only applies to the modern experience.
    if (experience !== "modern") return null;
    const middle = parts[1];
    if (!THEME_ID_PATTERN.test(middle)) return null;
    themeId = middle;
  }

  return { experience, colorMode, themeId };
}

export function isAppSkinPreference(value: unknown): value is AppSkinPreference {
  return parseAppSkinPreference(value) !== null;
}

export function toAppSkinPreference(
  experience: ExperienceId,
  colorMode: ColorMode,
  themeId: string = DEFAULT_MODERN_THEME_ID
): AppSkinPreference {
  // Classic has no theme axis; modern emits the legacy 2-part form for the
  // default theme so pre-theme-axis clients keep accepting it.
  if (experience === "classic" || themeId === DEFAULT_MODERN_THEME_ID) {
    return `${experience}-${colorMode}`;
  }
  return `modern-${themeId}-${colorMode}`;
}

export function getPreferenceFromAppState(
  appState?: ApplicationState | null
): AppSkinPreference | null {
  if (!appState) return null;
  return toAppSkinPreference(
    appState.experience,
    appState.colorMode,
    appState.themeId
  );
}
