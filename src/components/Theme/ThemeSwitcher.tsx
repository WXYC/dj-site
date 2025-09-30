"use client";

import { getAppSkinFromClient, setAppSkinCookie } from "@/lib/features/appSkin";
import { AppSkin } from "@/lib/features/authentication/types";
import { useAppSelector } from "@/lib/hooks";
import { AutoFixHigh, AutoFixOff } from "@mui/icons-material";
import { IconButton, Tooltip, useColorScheme } from "@mui/joy";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";

export function ThemeSwitchLoader() {
  return (
    <IconButton variant="soft" loading disabled>
      <AutoFixHigh />
    </IconButton>
  );
}

export default function ThemeSwitcher() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { mode } = useColorScheme();

  // Get appSkin from Redux state (if user is logged in) or client-side fallback
  const user = useAppSelector((state) => state.authentication.session.user);
  const currentAppSkin: AppSkin = user?.appSkin || getAppSkinFromClient();
  const isClassic = currentAppSkin === "classic";
  let nextModernMode = `modern-${mode}` as AppSkin;

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newAppSkin: AppSkin = isClassic ? nextModernMode : "classic";

      // Set cookie for immediate client-side effect
      setAppSkinCookie(newAppSkin);

      // TODO: If user is logged in, update their appSkin preference in the backend
      // This would require a mutation to update the user's appSkin field

      // Refresh the page to apply the new theme
      router.refresh();
    } catch (error) {
      console.error("Failed to switch theme:", error);
      toast.error("Failed to switch theme. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tooltip
      title={`Switch to ${isClassic ? "modern" : "classic"} view`}
      size="sm"
      placement="top-start"
      variant="outlined"
    >
      <IconButton
        id="toggle-classic"
        onClick={handleSwitch}
        loading={isLoading}
        disabled={isLoading}
      >
        {isClassic ? <AutoFixHigh /> : <AutoFixOff />}
      </IconButton>
    </Tooltip>
  );
}
