import { ApplicationState } from "@/lib/features/application/types";
import { ColorMode, ExperienceId } from "./types";
import {
  DEFAULT_MODERN_THEME_ID,
  THEME_ID_PATTERN,
  resolveModernThemeId,
} from "./modern/themes/registry";

/**
 * App-skin preference grammar (persisted in localStorage, the `app_state` cookie,
 * and the better-auth `appSkin` field):
 *
 *   classic-<mode>              e.g. "classic-light"          (no theme axis)
 *   modern-<themeId>-<mode>     e.g. "modern-bluenote-light"
 *
 * Theme ids are dash-free (`^[a-z0-9]+$`), so parsing splits on "-": the first
 * token is the experience, the last is the mode, and an optional middle token is
 * the theme id. Parsing is self-healing: a legacy 2-part `modern-<mode>` and any
 * unknown/renamed theme id resolve to a real theme, and the parse reports the
 * `canonical` string plus `needsRewrite` so callers can re-persist the fix. This
 * keeps stored preferences valid as themes are added, renamed, or retired.
 */
export type AppSkinPreference =
  | `${ExperienceId}-${ColorMode}`
  | `modern-${string}-${ColorMode}`;

export const APP_SKIN_STORAGE_KEY = "wxyc_app_skin";

export interface ParsedAppSkin {
  experience: ExperienceId;
  colorMode: ColorMode;
  /** A registered theme id (resolved; `DEFAULT_MODERN_THEME_ID` for classic). */
  themeId: string;
  /** The normalized preference string for this parse. */
  canonical: AppSkinPreference;
  /** True when the input differed from `canonical` (legacy form, unknown/renamed
   *  id) — the caller should re-persist `canonical` to heal the stored value. */
  needsRewrite: boolean;
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

  let rawThemeId = DEFAULT_MODERN_THEME_ID;
  if (parts.length === 3) {
    // Theme axis only applies to the modern experience.
    if (experience !== "modern") return null;
    const middle = parts[1];
    if (!THEME_ID_PATTERN.test(middle)) return null;
    rawThemeId = middle;
  }

  // Resolve to a real theme (aliases renamed ids, degrades unknowns) and report
  // whether the stored string drifted from the canonical form.
  const themeId =
    experience === "modern"
      ? resolveModernThemeId(rawThemeId)
      : DEFAULT_MODERN_THEME_ID;
  const canonical = toAppSkinPreference(experience, colorMode, themeId);

  return {
    experience,
    colorMode,
    themeId,
    canonical,
    needsRewrite: canonical !== value,
  };
}

export function isAppSkinPreference(value: unknown): value is AppSkinPreference {
  return parseAppSkinPreference(value) !== null;
}

export function toAppSkinPreference(
  experience: ExperienceId,
  colorMode: ColorMode,
  themeId: string = DEFAULT_MODERN_THEME_ID
): AppSkinPreference {
  // Classic has no theme axis; modern always emits the 3-part form with a
  // resolved (real) theme id — the default theme included.
  if (experience === "classic") {
    return `${experience}-${colorMode}`;
  }
  return `modern-${resolveModernThemeId(themeId)}-${colorMode}`;
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
