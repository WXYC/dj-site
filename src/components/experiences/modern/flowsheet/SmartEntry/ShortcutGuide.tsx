"use client";

import { Box, Typography } from "@mui/joy";
import type { ReactNode } from "react";

/** ⌘ on Apple platforms, Ctrl elsewhere — for the queue chord. Computed at
 *  render (the guide only ever mounts client-side, inside the results Popper). */
function modifierKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  const p = `${navigator.platform} ${navigator.userAgent}`;
  return /Mac|iPhone|iPad|iPod/.test(p) ? "⌘" : "Ctrl";
}

function Key({ children }: { children: ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        fontFamily: "code",
        fontSize: "0.6rem",
        lineHeight: 1,
        px: 0.4,
        py: 0.25,
        borderRadius: "xs",
        bgcolor: "background.level1",
        border: "1px solid",
        borderColor: "divider",
        color: "text.secondary",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The keyboard-shortcut legend pinned to the bottom of the results pane — a
 * revival of the old FlowsheetResultsListbox legend, updated for the v2 keys.
 * The Tab hint is live: it names what Tab will actually do next ("add artist",
 * "cycle field", …); "→ accept" and "↑↓ navigate" appear only when a ghost /
 * results are present.
 */
export default function ShortcutGuide({
  tabHint,
  ghostActive,
  showResultsNav,
}: {
  tabHint: string | null;
  ghostActive: boolean;
  showResultsNav: boolean;
}) {
  const mod = modifierKey();
  const items: Array<{ keys: string; label: string }> = [];
  if (tabHint) items.push({ keys: "Tab", label: tabHint });
  if (ghostActive) items.push({ keys: "→", label: "accept" });
  if (showResultsNav) items.push({ keys: "↑↓", label: "navigate" });
  items.push({ keys: "↵", label: "play" });
  items.push({ keys: `${mod}↵`, label: "queue" });
  items.push({ keys: "Esc", label: "cancel" });

  return (
    <Box
      role="group"
      aria-label="Keyboard shortcuts"
      data-testid="flowsheet-shortcut-guide"
      sx={{
        flexShrink: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        columnGap: 2.25,
        rowGap: 0.5,
        px: 1.25,
        py: 0.6,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.surface",
      }}
    >
      {items.map((s) => (
        <Box
          key={s.keys}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.4 }}
        >
          <Key>{s.keys}</Key>
          <Typography
            level="body-xs"
            sx={{ color: "text.tertiary", fontSize: "0.66rem", lineHeight: 1 }}
          >
            {s.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
