import type { Rotation } from "@/lib/features/rotation/types";

/**
 * Rotation bin metadata (ids + display labels).
 *
 * The per-bin COLORS now live in the theme's `rotation` palette slot
 * (`theme.vars.palette.rotation.{heavy,medium,light,singles}.*`, see
 * lib/features/experiences/modern/themes) so they retheme with the color
 * system; the old hardcoded light/dark hex tables were removed.
 */

export const ROTATION_BINS: Rotation[] = ["H", "M", "L", "S"];

export const ROTATION_BIN_LABELS: Record<Rotation, string> = {
  H: "Heavy",
  M: "Medium",
  L: "Light",
  S: "Singles",
};
