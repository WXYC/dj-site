"use client";

import { authClient } from "@/lib/features/authentication/client";
import { ApplicationState } from "@/lib/features/application/types";
import {
  APP_SKIN_STORAGE_KEY,
  AppSkinPreference,
  getPreferenceFromAppState,
  isAppSkinPreference,
  parseAppSkinPreference,
  toAppSkinPreference,
} from "@/lib/features/experiences/preferences";
import { useSetExperiencePreferenceMutation } from "@/lib/features/experiences/api";
import { useColorScheme } from "@mui/joy/styles";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

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

  const persistPreference = useCallback(
    async (preference: AppSkinPreference, options: PersistOptions = {}) => {
      writeLocalPreference(preference);

      try {
        await setPreference({ preference }).unwrap();
      } catch (error) {
        console.error("Failed to update app_state preference:", error);
      }

      if (options.updateUser && session?.user?.id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- appSkin is a custom field not in better-auth's updateUser type
          await authClient.updateUser({ appSkin: preference } as any);
        } catch (error) {
          console.error("Failed to update user appSkin:", error);
        }
      }
    },
    [setPreference, session?.user?.id]
  );

  return { persistPreference };
}

export function useThemePreferenceSync() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { mode, setMode } = useColorScheme();
  const { persistPreference } = useThemePreferenceActions();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current || !mode) return;

    const sync = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- appSkin is a custom field not in better-auth's session user type
      const appSkinParsed = parseAppSkinPreference((session?.user as any)?.appSkin);
      const localPreference = readLocalPreference();

      let resolvedPreference: AppSkinPreference | null = null;
      
      if (appSkinParsed) {
        resolvedPreference = toAppSkinPreference(appSkinParsed.experience, appSkinParsed.colorMode);
      } else if (localPreference) {
        resolvedPreference = localPreference;
      }

      if (!resolvedPreference) {
        const appState = await fetchAppState();
        resolvedPreference = getPreferenceFromAppState(appState) ?? null;
      }

      if (!resolvedPreference) {
        hasSyncedRef.current = true;
        return;
      }

      const parsed = parseAppSkinPreference(resolvedPreference);
      if (!parsed) {
        hasSyncedRef.current = true;
        return;
      }

      const nextMode = parsed.colorMode;
      if (mode !== nextMode) {
        setMode(nextMode);
      }

      await persistPreference(resolvedPreference, { updateUser: false });

      const shouldRefresh =
        typeof window !== "undefined" &&
        resolvedPreference.startsWith("classic") !==
          document.documentElement.dataset.experience?.startsWith("classic");

      if (shouldRefresh) {
        router.refresh();
      }

      hasSyncedRef.current = true;
    };

    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any -- appSkin is a custom field not in better-auth's session user type; complex expression is intentional
  }, [mode, persistPreference, router, (session?.user as any)?.appSkin, setMode]);
}

export function buildPreference(
  experience: "classic" | "modern",
  colorMode: "light" | "dark"
): AppSkinPreference {
  return toAppSkinPreference(experience, colorMode);
}
