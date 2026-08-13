import {
  APP_SKIN_STORAGE_KEY,
  AppSkinPreference,
  isAppSkinPreference,
} from "./preferences";

/**
 * localStorage access for the app-skin preference.
 *
 * Split out from the theme hooks so callers that must stay free of MUI — the
 * classic experience imports no Joy UI anywhere — can persist a preference
 * without pulling in the theme provider graph.
 *
 * Both helpers swallow storage failures: Safari private mode and a full quota
 * both throw on access, and a preference that fails to cache locally is still
 * written to the cookie and the account record.
 */
export function readLocalAppSkin(): AppSkinPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(APP_SKIN_STORAGE_KEY);
    return isAppSkinPreference(stored) ? stored : null;
  } catch (error) {
    console.error("Failed to read app skin from localStorage:", error);
    return null;
  }
}

export function writeLocalAppSkin(preference: AppSkinPreference): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APP_SKIN_STORAGE_KEY, preference);
  } catch (error) {
    console.error("Failed to write app skin to localStorage:", error);
  }
}
