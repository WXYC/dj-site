import type { ColorPaletteProp, VariantProp } from "@mui/joy/styles";
import type { Format, Genre } from "@/lib/features/catalog/types";
import type { Rotation } from "@/lib/features/rotation/types";

/**
 * Layer B of the color system: a typed mapping from WXYC domain roles to Joy
 * `{ color, variant }` pairs, for components whose `color=`/`variant=` props take
 * palette names. This is app semantics and is theme-independent — themes vary the
 * palettes underneath; the role→palette assignment stays fixed.
 *
 * Layer A (real distinct colors: sidebar/format hues, exclusive purple, on-air
 * red, rotation bins) lives in the theme palette and is consumed via
 * `theme.vars.palette.*`.
 */
export interface Tone {
  color: ColorPaletteProp;
  variant: VariantProp;
}

/** Tone for format chips, which use the dedicated `formatVinyl`/`formatCd` slots. */
export interface FormatTone {
  color: ColorPaletteProp | "formatVinyl" | "formatCd";
  variant: VariantProp;
}

export const GENRE_TONES: Record<Genre, Tone> = {
  Rock: { color: "primary", variant: "solid" },
  Blues: { color: "success", variant: "soft" },
  Electronic: { color: "success", variant: "solid" },
  Hiphop: { color: "primary", variant: "soft" },
  Jazz: { color: "warning", variant: "solid" },
  Classical: { color: "neutral", variant: "soft" },
  Reggae: { color: "warning", variant: "soft" },
  Soundtracks: { color: "neutral", variant: "soft" },
  OCS: { color: "success", variant: "soft" },
  Unknown: { color: "neutral", variant: "soft" },
};

/**
 * Resolve any genre value (possibly missing or not a known `Genre`) to its
 * tone. Mirrors `formatTone` so callers never index GENRE_TONES with an
 * unvalidated string.
 */
export function genreTone(genre: string | null | undefined): Tone {
  return GENRE_TONES[(genre ?? "Unknown") as Genre] ?? GENRE_TONES.Unknown;
}

export const FORMAT_TONES: Record<Format, FormatTone> = {
  Vinyl: { color: "formatVinyl", variant: "soft" },
  CD: { color: "formatCd", variant: "soft" },
  Unknown: { color: "neutral", variant: "soft" },
};

/**
 * Resolve any format string to its tone. `Format` is a cast string, not a real
 * closed union (the backend sends "cd", "LP", "CD-R", …), so callers must NOT
 * index FORMAT_TONES directly — normalize here and always return a valid tone.
 */
export function formatTone(format: string | null | undefined): FormatTone {
  const f = (format ?? "").toLowerCase();
  if (f.includes("vinyl")) return FORMAT_TONES.Vinyl;
  if (f.includes("cd")) return FORMAT_TONES.CD;
  return FORMAT_TONES.Unknown;
}

export const ROTATION_TONES: Record<Rotation, Tone> = {
  H: { color: "primary", variant: "solid" },
  M: { color: "warning", variant: "solid" },
  L: { color: "success", variant: "solid" },
  S: { color: "neutral", variant: "solid" },
};

export type EntryRole =
  | "startShow"
  | "endShow"
  | "talkset"
  | "breakpoint"
  | "generic";
export const ENTRY_TONES: Record<EntryRole, Tone> = {
  startShow: { color: "success", variant: "soft" },
  endShow: { color: "primary", variant: "soft" },
  talkset: { color: "danger", variant: "soft" },
  breakpoint: { color: "warning", variant: "soft" },
  generic: { color: "warning", variant: "soft" },
};

export type AdminRoleTone = "role" | "editor" | "webmaster" | "newDj";
export const ADMIN_TONES: Record<AdminRoleTone, Tone> = {
  role: { color: "success", variant: "soft" },
  editor: { color: "success", variant: "solid" },
  webmaster: { color: "primary", variant: "solid" },
  newDj: { color: "warning", variant: "soft" },
};
