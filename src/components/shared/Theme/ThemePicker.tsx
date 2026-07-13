"use client";

import { useRef, useState, type JSX } from "react";
import { Check, PaletteRounded } from "@mui/icons-material";
import {
  Box,
  IconButton,
  ListItemDecorator,
  Menu,
  MenuItem,
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

  // Controlled Menu (rather than Dropdown/MenuButton): the trigger is a plain
  // IconButton so it composes into the surrounding ButtonGroup, which clones its
  // children with data-*-child markers a Dropdown wrapper would swallow.
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const select = async (id: string) => {
    setOpen(false);
    if (id === themeId) return;

    // Optimistically update the context (keeps other consumers in sync).
    setThemeId(id);
    // Persist to the app_state cookie / account, then reload. Joy's
    // CssVarsProvider does not regenerate the injected :root CSS variables when
    // the theme object changes at runtime, and router.refresh() is a soft
    // refresh that won't re-mount the provider — so a full reload (which
    // re-runs SSR from the now-persisted themeId) is what actually repaints.
    await persistPreference(buildPreference("modern", resolvedMode, id), {
      updateUser: true,
    });
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <>
      <IconButton
        ref={buttonRef}
        aria-label="Choose color theme"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose color theme"
        onClick={() => setOpen((o) => !o)}
      >
        <PaletteRounded />
      </IconButton>
      <Menu
        anchorEl={buttonRef.current}
        open={open}
        onClose={() => setOpen(false)}
        placement="top-end"
        sx={{ zIndex: 10001, minWidth: 200 }}
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
    </>
  );
}
