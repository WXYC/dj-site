"use client";

import { DarkModeRounded, LightModeRounded } from "@mui/icons-material";
import { Tooltip } from "@mui/joy";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";

export function ColorSchemeToggleLoader(): JSX.Element {
  return (
    <IconButton variant="soft" loading disabled>
      <DarkModeRounded />
    </IconButton>
  );
}

export default function ColorSchemeToggle(): JSX.Element {
  const { mode, setMode } = useColorScheme();

  return (
    <Tooltip
      title={`Switch to ${mode == "dark" ? "light" : "dark"} mode`}
      size="sm"
      placement="bottom"
      variant="outlined"
    >
      <IconButton
        id="toggle-mode"
        onClick={() => {
          if (mode === "light") {
            setMode("dark");
          } else {
            setMode("light");
          }
        }}
      >
        {mode === "light" ? <DarkModeRounded /> : <LightModeRounded />}
      </IconButton>
    </Tooltip>
  );
}
