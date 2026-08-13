"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/features/authentication/client";
import { useSetExperiencePreferenceMutation } from "@/lib/features/experiences/api";
import { writeLocalAppSkin } from "@/lib/features/experiences/local-storage";
import { toAppSkinPreference } from "@/lib/features/experiences/preferences";
import type { ColorMode, ExperienceId } from "@/lib/features/experiences/types";

type ExperienceSwitchArgs = {
  /** The experience to move to. */
  target: ExperienceId;
  /** Carried across the switch so the move doesn't also reset light/dark. */
  colorMode: ColorMode;
  /**
   * Carried across the switch so a classic user returning to modern lands on
   * the theme they chose. Classic has no theme axis, so this is the last
   * modern theme rather than the current one.
   */
  themeId?: string;
};

/**
 * Moves the viewer to the other experience and reloads.
 *
 * Deliberately independent of `themePreferenceHooks`, which imports Joy UI at
 * module scope: this is the switch the classic experience uses, and classic
 * imports no MUI.
 *
 * The reload is a full navigation rather than `router.refresh()` because the
 * experience selects which Joy theme `CssVarsProvider` receives, and the
 * provider does not regenerate its injected `:root` variables on a soft
 * refresh. A failed cookie write skips the reload — SSR would only repaint the
 * experience the viewer is already in, which reads as the button doing nothing.
 */
export function useExperienceSwitch({
  target,
  colorMode,
  themeId,
}: ExperienceSwitchArgs) {
  const [setPreference] = useSetExperiencePreferenceMutation();
  const [pending, setPending] = useState(false);

  const switchExperience = useCallback(async () => {
    setPending(true);
    const preference = toAppSkinPreference(target, colorMode, themeId);
    writeLocalAppSkin(preference);

    try {
      await setPreference({ preference }).unwrap();
    } catch (error) {
      console.error("Failed to update app_state preference:", error);
      toast.error("Couldn't switch experiences — please try again.");
      setPending(false);
      return;
    }

    // Best-effort: the cookie already carries the switch, so a failed account
    // write costs cross-device stickiness, not this navigation.
    try {
      await authClient.updateUser({ appSkin: preference } as never);
    } catch (error) {
      console.error("Failed to update user appSkin:", error);
    }

    if (typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    setPending(false);
  }, [colorMode, setPreference, target, themeId]);

  return { switchExperience, pending };
}
