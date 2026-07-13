"use client";

import type { JSX } from "react";
import { Check, PaletteRounded } from "@mui/icons-material";
import {
  Box,
  Dropdown,
  IconButton,
  ListItemDecorator,
  Menu,
  MenuButton,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import {
  MODERN_THEME_LIST,
  getThemeSwatches,
} from "@/lib/features/experiences/modern/themes/registry";
import { useModernTheme } from "@/src/styles/ModernThemeContext";
import {
  buildPreference,
  useThemePreferenceActions,
} from "@/src/hooks/themePreferenceHooks";

export function ThemePickerLoader(): JSX.Element {
  return (
    <IconButton variant="soft" loading disabled>
      <PaletteRounded />
    </IconButton>
  );
}

function Swatches({
  colors,
  label,
}: {
  colors: string[];
  label: string;
}): JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{ display: "inline-flex", gap: "3px", alignItems: "center" }}
      title={label}
    >
      {colors.map((c, i) => (
        <Box
          key={i}
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: c,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.15) inset",
          }}
        />
      ))}
    </Box>
  );
}

export default function ThemePicker(): JSX.Element {
  const { mode } = useColorScheme();
  const resolvedMode = mode === "dark" ? "dark" : "light";
  const { themeId, setThemeId } = useModernTheme();
  const { persistPreference } = useThemePreferenceActions();

  const select = (id: string) => {
    if (id !== themeId) setThemeId(id);
    // Persist for this (modern) experience, carrying the chosen theme.
    persistPreference(buildPreference("modern", resolvedMode, id), {
      updateUser: true,
    });
  };

  return (
    <Dropdown>
      <Tooltip title="Choose color theme" size="sm" placement="top-start" variant="outlined">
        <MenuButton
          slots={{ root: IconButton }}
          slotProps={{ root: { "aria-label": "Choose color theme" } }}
        >
          <PaletteRounded />
        </MenuButton>
      </Tooltip>
      <Menu
        sx={{ zIndex: 10001, minWidth: 200 }}
        popperOptions={{ placement: "top-end" }}
      >
        <Typography
          level="body-xs"
          sx={{ px: 1.5, py: 0.5, textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Color theme
        </Typography>
        {MODERN_THEME_LIST.map((def) => {
          const active = def.id === themeId;
          return (
            <MenuItem
              key={def.id}
              role="menuitemradio"
              aria-checked={active}
              selected={active}
              onClick={() => select(def.id)}
              sx={{ gap: 1 }}
            >
              <ListItemDecorator>
                {active ? <Check fontSize="small" /> : null}
              </ListItemDecorator>
              <Typography level="body-sm" sx={{ flex: 1 }}>
                {def.label}
              </Typography>
              <Swatches
                colors={getThemeSwatches(def, resolvedMode)}
                label={`${def.label} preview`}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </Dropdown>
  );
}
