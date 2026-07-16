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
   * Persists to localStorage, the app_state cookie, and (optionally) the
   * account record. Returns whether the cookie write — the source SSR
   * repaints from — succeeded, so callers know if a reload would help.
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
  // Live mirror of color mode: reads after an await must see a user's
  // mid-sync toggle, not the value captured when the effect first ran (#611).
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Set only on actual unmount (empty-dep cleanup) — a mere dep change (e.g.
  // session appSkin arriving) must not abort a sync already committed to
  // by the synchronous guard below (#611).
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Tracks WHAT was synced, not just that a sync ran: the better-auth session
  // resolves asynchronously, so the account's authoritative appSkin can
  // arrive after the first (local-state) sync completed and must still apply
  // (#611). A later run re-syncs only when the claimed appSkin changed.
  // Syncs chain onto one promise so they never run concurrently, and a
  // re-sync landing on an already-applied canonical preference is a no-op.
  const hasSyncedRef = useRef(false);
  const lastClaimedAppSkinRef = useRef<unknown>(undefined);
  const lastAppliedCanonicalRef = useRef<AppSkinPreference | null>(null);
  const syncChainRef = useRef<Promise<void>>(Promise.resolve());

  const sessionAppSkin = (session?.user as any)?.appSkin;

  useEffect(() => {
    if (!mode) return;
    if (
      hasSyncedRef.current &&
      lastClaimedAppSkinRef.current === sessionAppSkin
    ) {
      return;
    }

    // Claim synchronously: a dep change (typically session appSkin resolving
    // mid-fetch) re-fires this effect, and without claiming up front a
    // second sync() would race the first, calling setMode/setThemeId/
    // persistPreference out of order (#611).
    hasSyncedRef.current = true;
    lastClaimedAppSkinRef.current = sessionAppSkin;
    const modeAtSyncStart = mode;

    const sync = async () => {
      // Resolve a preference from the first available source, in priority order.
      let parsed: ParsedAppSkin | null =
        parseAppSkinPreference(sessionAppSkin) ??
        parseAppSkinPreference(readLocalPreference());

      if (!parsed) {
        const appState = await fetchAppState();
        if (unmountedRef.current) return;
        parsed = parseAppSkinPreference(getPreferenceFromAppState(appState));
      }

      if (!parsed) {
        return;
      }

      // A re-sync (e.g. late-arriving account appSkin) landing on what an
      // earlier sync already applied must not re-persist or reload-check.
      if (parsed.canonical === lastAppliedCanonicalRef.current) {
        return;
      }

      // A mid-sync theme toggle wins: read the live value, not the
      // closure-captured `mode`, so we don't revert the user's choice back
      // to the server-resolved mode (#611).
      const userToggledMode = modeRef.current !== modeAtSyncStart;
      if (!userToggledMode && modeRef.current !== parsed.colorMode) {
        setMode(parsed.colorMode);
      }

      if (parsed.experience === "modern") {
        setThemeId(parsed.themeId);
      }

      lastAppliedCanonicalRef.current = parsed.canonical;

      // Self-heal: push the canonical form to the account only when the
      // stored value drifted (legacy form, renamed/unknown theme id), so it
      // stops coming back stale.
      const persisted = await persistPreference(parsed.canonical, {
        updateUser: parsed.needsRewrite,
      });
      if (unmountedRef.current) return;

      // Joy's CssVarsProvider can't regenerate its injected :root vars at
      // runtime, so a full reload is the only way to repaint when SSR
      // painted a different experience or modern theme than resolved here
      // (router.refresh() won't re-mount the provider). Reload only once the
      // cookie persisted, or the next SSR repaints the same stale theme and
      // this sync loops.
      //
      // RHS defaults to `false` (not `undefined`) when <html data-experience>
      // is absent, since an unset attribute means SSR painted the modern
      // default — comparing against `undefined` made this always-true and
      // fired a reload on every first load (#611).
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

    // Queue behind any in-flight sync so they never interleave; catch so one
    // failed sync can't wedge the chain and block every later re-sync.
    syncChainRef.current = syncChainRef.current.then(sync).catch((error) => {
      console.error("Theme preference sync failed:", error);
    });
  }, [mode, persistPreference, sessionAppSkin, setMode, setThemeId, paintedThemeId]);
}

export function buildPreference(
  experience: "classic" | "modern",
  colorMode: "light" | "dark",
  themeId?: string
): AppSkinPreference {
  return toAppSkinPreference(experience, colorMode, themeId);
}
