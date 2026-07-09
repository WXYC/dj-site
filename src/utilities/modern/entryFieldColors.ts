import { ColorPaletteProp } from "@mui/joy";

// Mirrors SMART_ENTRY_FIELD_COLOR on feat/flowsheet-entry-redesign
// (SmartEntry/smartEntryStyles.ts). Key names match its SmartField union so
// that branch can re-export from here once either lands.
export type EntryFieldName = "song" | "artist" | "album" | "label";

export const ENTRY_FIELD_COLOR: Record<
  EntryFieldName,
  ColorPaletteProp | "plain"
> = {
  song: "plain",
  artist: "primary",
  album: "success",
  label: "warning",
};

// Playing rows render on a solid primary background, so tints invert to
// keep contrast.
export function entryFieldTextColor(
  field: EntryFieldName,
  playing: boolean
): string {
  if (playing) return "common.white";
  const color = ENTRY_FIELD_COLOR[field];
  return color === "plain" ? "text.primary" : `${color}.plainColor`;
}
