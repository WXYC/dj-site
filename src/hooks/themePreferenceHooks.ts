"use client";

import { authClient } from "@/lib/features/authentication/client";
import { ApplicationState } from "@/lib/features/application/types";
import {
  APP_SKIN_STORAGE_KEY,
  AppSkinPreference,
  ParsedAppSkin,
  getPreferenceFromAppState,
  isAppSkinPreference,
  parseAppSkinPreference,
  toAppSkinPreference,
} from "@/lib/features/experiences/preferences";
import { useSetExperiencePreferenceMutation } from "@/lib/features/experiences/api";
import { useModernTheme } from "@/src/styles/ModernThemeContext";
import { useColorScheme } from "@mui/joy/styles";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

type PersistOptions = {
  updateUser?: boolean;
};

function readLocalPreference(): AppSkinPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(APP_SKIN_STORAGE_KEY);
    return isAppSkinPreference(stored) ? stored : null;
  } catch (error) {
    console.error("Failed to read app skin from localStorage:", error);
    return null;
  }
}

function writeLocalPreference(preference: AppSkinPreference) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APP_SKIN_STORAGE_KEY, preference);
  } catch (error) {
    console.error("Failed to write app skin to localStorage:", error);
  }
}

async function fetchAppState(): Promise<ApplicationState | null> {
  try {
    const response = await fetch("/api/view", { method: "GET" });
    if (!response.ok) return null;
    return (await response.json()) as ApplicationState;
  } catch (error) {
    console.error("Failed to fetch app_state:", error);
    return null;
  }
}

export function useThemePreferenceActions() {
  const { data: session } = authClient.useSession();
  const [setPreference] = useSetExperiencePreferenceMutation();

  /**
   * Persist a preference to localStorage, the app_state cookie, and
   * (optionally) the account record. Returns whether the cookie write —
   * the source SSR repaints from — succeeded, so callers can decide
   * whether a reload would actually pick the new preference up.
   */
  const persistPreference = useCallback(
    async (
      preference: AppSkinPreference,
      options: PersistOptions = {}
    ): Promise<boolean> => {
      writeLocalPreference(preference);

      let cookiePersisted = true;
      try {
        await setPreference({ preference }).unwrap();
      } catch (error) {
        console.error("Failed to update app_state preference:", error);
        toast.error("Couldn't save your theme preference — it may not stick.");
        cookiePersisted = false;
      }

      if (options.updateUser && session?.user?.id) {
        try {
          await authClient.updateUser({ appSkin: preference } as any);
        } catch (error) {
          console.error("Failed to update user appSkin:", error);
          toast.error(
            "Couldn't sync the theme to your account — other devices may not pick it up."
          );
        }
      }

      return cookiePersisted;
    },
    [setPreference, session?.user?.id]
  );

  return { persistPreference };
}

export function useThemePreferenceSync() {
  const { data: session } = authClient.useSession();
  const { mode, setMode } = useColorScheme();
  const { themeId: paintedThemeId, setThemeId } = useModernTheme();
  const { persistPreference } = useThemePreferenceActions();
  const hasSyncedRef = useRef(false);
  // Live mirror of the color mode: reads after an await must observe a user's
  // mid-sync toggle, not the value captured when the effect first ran (#611).
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Set only when the component actually unmounts (empty-dep cleanup), so a
  // mere dep change — e.g. the session's appSkin arriving — does not abort the
  // one sync the synchronous guard below already committed to (#611).
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (hasSyncedRef.current || !mode) return;

    // Claim the sync synchronously. A dep change (most commonly the session's
    // appSkin resolving mid-fetch) re-fires this effect; without claiming the
    // guard up front a second sync() would race the first and call
    // setMode/setThemeId/persistPreference out of order (#611).
    hasSyncedRef.current = true;
    const modeAtSyncStart = mode;

    const sync = async () => {
      // Resolve a preference from the first available source, in priority order.
      let parsed: ParsedAppSkin | null =
        parseAppSkinPreference((session?.user as any)?.appSkin) ??
        parseAppSkinPreference(readLocalPreference());

      if (!parsed) {
        const appState = await fetchAppState();
        if (unmountedRef.current) return;
        parsed = parseAppSkinPreference(getPreferenceFromAppState(appState));
      }

      if (!parsed) {
        return;
      }

      // Respect a mid-sync theme toggle: if the user changed the color mode
      // while we were resolving the preference, their choice wins — reading the
      // live value (not the closure-captured `mode`) keeps us from reverting it
      // to the server-resolved mode (#611).
      const userToggledMode = modeRef.current !== modeAtSyncStart;
      if (!userToggledMode && modeRef.current !== parsed.colorMode) {
        setMode(parsed.colorMode);
      }

      if (parsed.experience === "modern") {
        setThemeId(parsed.themeId);
      }

      // Self-heal: persist the canonical form everywhere, and push it to the
      // backend user record only when the stored value drifted (legacy 2-part
      // form, or a renamed/unknown theme id) so it stops coming back stale.
      const persisted = await persistPreference(parsed.canonical, {
        updateUser: parsed.needsRewrite,
      });
      if (unmountedRef.current) return;

      // Joy's CssVarsProvider can't regenerate its injected :root vars at
      // runtime (see ThemePicker), so if SSR painted a different experience
      // OR a different modern theme than the resolved preference, only a full
      // reload repaints correctly — router.refresh() is a soft refresh that
      // won't re-mount the provider. Reload only once the cookie actually
      // persisted; otherwise the next SSR would paint the same stale theme
      // and this sync would loop.
      //
      // The RHS defaults to `false` when <html data-experience> is absent: an
      // unset attribute means SSR painted the default (modern) experience, so a
      // reload is warranted only when the resolved preference is classic-shaped
      // and thus disagrees with that default. Comparing against a bare
      // `undefined` made this `boolean !== undefined` — always true — and fired
      // a reload on every first load before the attribute was set (#611).
      const experienceMismatch =
        typeof window !== "undefined" &&
        parsed.canonical.startsWith("classic") !==
          (document.documentElement.dataset.experience?.startsWith("classic") ??
            false);
      // Both ids are registry-resolved, so this comparison is loop-safe.
      const themeMismatch =
        parsed.experience === "modern" && parsed.themeId !== paintedThemeId;

      if (persisted && (experienceMismatch || themeMismatch)) {
        window.location.reload();
      }
    };

    sync();
  }, [mode, persistPreference, (session?.user as any)?.appSkin, setMode, setThemeId, paintedThemeId]);
}

export function buildPreference(
  experience: "classic" | "modern",
  colorMode: "light" | "dark",
  themeId?: string
): AppSkinPreference {
  return toAppSkinPreference(experience, colorMode, themeId);
}
