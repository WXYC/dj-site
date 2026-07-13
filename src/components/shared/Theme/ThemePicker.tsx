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
import { ClickAwayListener } from "@mui/material";
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
  const { themeId } = useModernTheme();
  const { persistPreference } = useThemePreferenceActions();

  // Controlled Menu (rather than Dropdown/MenuButton): the trigger is a plain
  // IconButton so it composes into the surrounding ButtonGroup, which clones its
  // children with data-*-child markers a Dropdown wrapper would swallow.
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const select = async (id: string) => {
    setOpen(false);
    if (id === themeId) return;

    // Persist to the app_state cookie / account, then reload. Joy's
    // CssVarsProvider does not regenerate the injected :root CSS variables when
    // the theme object changes at runtime, and router.refresh() is a soft
    // refresh that won't re-mount the provider — so a full reload (which
    // re-runs SSR from the now-persisted themeId) is what actually repaints.
    // (No optimistic context update first: it can't repaint anything before
    // the reload, and if persisting failed it would leave the picker claiming
    // a theme the page isn't showing.) Skip the reload when the cookie write
    // failed — SSR would just repaint the old theme.
    const persisted = await persistPreference(
      buildPreference("modern", resolvedMode, id),
      { updateUser: true }
    );
    if (persisted && typeof window !== "undefined") window.location.reload();
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
      {/* The Menu is controlled standalone (no Dropdown context), so Joy never
          wires up its built-in click-away — only Escape closes it. The house
          ClickAwayListener (same as the flowsheet dropdowns) covers pointer and
          touch; presses on the trigger are excluded since its own onClick
          toggles. Mounted only while open — ClickAwayListener needs a child
          that renders a DOM node, and a closed Joy Menu renders none. */}
      {open && (
        <ClickAwayListener
          onClickAway={(event) => {
            if (buttonRef.current?.contains(event.target as Node)) return;
            setOpen(false);
          }}
        >
          <Menu
            anchorEl={buttonRef.current}
            open
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
        </ClickAwayListener>
      )}
    </>
  );
}
