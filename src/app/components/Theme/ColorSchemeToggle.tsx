"use client";

import { useAppDispatch } from "@/lib/hooks";
import { applicationSlice } from "@/lib/slices/application/slice";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";

export function ColorSchemeToggle(): JSX.Element {
  const { mode, setMode } = useColorScheme();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(applicationSlice.actions.getRouteStyle(pathname));
  }, [pathname, dispatch]);

  return (
    <Suspense
      fallback={
        <IconButton size="sm" variant="plain" color="neutral" disabled />
      }
    >
      <IconButton
        id="toggle-mode"
        size="sm"
        variant="plain"
        color="neutral"
        onClick={() => {
          if (mode === "light") {
            setMode("dark");
          } else {
            setMode("light");
          }
        }}
      >
        {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
      </IconButton>
    </Suspense>
  );
}
