"use client";
/**
 * Greyscales the entire dashboard shell while auto-DJ is on the air. Auto-DJ is
 * a station-wide state, so every dj-site user sees the theme shift. Wraps the
 * modern dashboard's flex shell (replaces its outer Box).
 */
import { Box } from "@mui/joy";
import type { ReactNode } from "react";
import { useAutoDJActive } from "@/lib/features/autoDJ/hooks";

export default function AutoDJGreyscale({ children }: { children: ReactNode }) {
  const active = useAutoDJActive();
  return (
    <Box
      data-auto-dj-active={active ? "true" : "false"}
      // Filter goes on inline `style` (not `sx`) so the greyscale toggle is a
      // plain DOM style — simple and directly assertable.
      style={{
        filter: active ? "grayscale(1)" : "none",
        transition: "filter 0.4s ease",
      }}
      sx={{ display: "flex", height: "100dvh", overflow: "hidden" }}
    >
      {children}
    </Box>
  );
}
