"use client";

import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import IconButton from "@mui/joy/IconButton";
import { useColorScheme } from "@mui/joy/styles";
import React, { useEffect, useState } from "react";

interface ColorSchemeToggleProps {
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Component for toggling the color scheme of the application.
 *
 * @component
 * @category Theme
 *
 * @param {Object} props - The component props.
 * @param {Function} [props.onClick] - The callback function to be called when the toggle button is clicked.
 *
 * @returns {JSX.Element} The rendered ColorSchemeToggle component.
 *
 * @see [ColorSchemeToggle (Joy-UI component)](https://mui.com/joy-ui/customization/dark-mode/)
 */
export function ColorSchemeToggle(props: ColorSchemeToggleProps): JSX.Element {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <IconButton size="sm" variant="plain" color="neutral" disabled />;
  }
  return (
    <IconButton
      id="toggle-mode"
      size="sm"
      variant="plain"
      color="neutral"
      {...props}
      onClick={(event) => {
        if (mode === "light") {
          setMode("dark");
        } else {
          setMode("light");
        }
        props.onClick?.(event);
      }}
    >
      {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
    </IconButton>
  );
}
