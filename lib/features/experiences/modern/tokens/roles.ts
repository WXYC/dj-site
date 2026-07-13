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

/** Spread helper: `<Chip {...tone(GENRE_TONES[g])} />`. */
export function tone<T extends { color: string; variant: VariantProp }>(t: T): T {
  return t;
}

// --- Genre badges (was GENRE_COLORS/GENRE_VARIANTS in ArtistAvatar) ---
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

// --- Format badges (dedicated hues; replaces the 4 inconsistent CD/vinyl rules) ---
export const FORMAT_TONES: Record<Format, FormatTone> = {
  Vinyl: { color: "formatVinyl", variant: "soft" },
  CD: { color: "formatCd", variant: "soft" },
  Unknown: { color: "neutral", variant: "soft" },
};

// --- Rotation level (was ROTATION_STYLES / rotationstyles.ts) ---
export const ROTATION_TONES: Record<Rotation, Tone> = {
  H: { color: "primary", variant: "solid" },
  M: { color: "warning", variant: "solid" },
  L: { color: "success", variant: "solid" },
  S: { color: "neutral", variant: "solid" },
};

// --- Play / queue / live status ---
export type StatusRole =
  | "playing"
  | "queued"
  | "idle"
  | "live"
  | "request"
  | "segue";
export const STATUS_TONES: Record<StatusRole, Tone> = {
  playing: { color: "primary", variant: "solid" },
  queued: { color: "success", variant: "solid" },
  idle: { color: "neutral", variant: "soft" },
  live: { color: "danger", variant: "solid" },
  request: { color: "warning", variant: "solid" },
  segue: { color: "primary", variant: "solid" },
};

// --- Flowsheet message entries ---
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

// --- Library membership ---
export const LIBRARY_TONES = {
  in: { color: "success", variant: "soft" } as Tone,
  out: { color: "danger", variant: "soft" } as Tone,
};

// --- Bin / catalog actions ---
export type ActionRole = "play" | "queue" | "delete" | "cta";
export const ACTION_TONES: Record<ActionRole, Tone> = {
  play: { color: "primary", variant: "solid" },
  queue: { color: "success", variant: "solid" },
  delete: { color: "danger", variant: "plain" },
  // Generic primary call-to-action (replaces "success as generic CTA" in admin).
  cta: { color: "success", variant: "solid" },
};

// --- Admin roster ---
export type AdminRoleTone = "role" | "editor" | "webmaster" | "newDj";
export const ADMIN_TONES: Record<AdminRoleTone, Tone> = {
  role: { color: "success", variant: "soft" },
  editor: { color: "success", variant: "solid" },
  webmaster: { color: "primary", variant: "solid" },
  newDj: { color: "warning", variant: "soft" },
};
