import type { ColorPaletteProp, VariantProp } from "@mui/joy/styles";
import type { Format } from "@/lib/features/catalog/types";
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

/**
 * Chip tones for the genres the modern experience has a designed color for.
 *
 * This is a **presentation table, not the genre vocabulary**. The library's
 * genres are server-owned (`GET /library/genres`) and the table grows without
 * a dj-site deploy, so a genre missing from here is the normal case, not a bad
 * value: it resolves to the neutral `Unknown` tone via `genreTone` and still
 * renders its own name. Never read a miss as "that genre doesn't exist", and
 * never use these keys to validate or rewrite genre data.
 *
 * `Unknown` is the fallback entry for a release with no genre at all; it is
 * not one of the library's genres.
 */
export const GENRE_TONES = {
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
} satisfies Record<string, Tone>;

/**
 * A key of the tone table above — i.e. a genre dj-site happens to have a chip
 * color for. Derived from the table so the two can never drift. This is a
 * styling subset and makes no claim about which genres exist; genre data is
 * typed `string` (`ArtistEntry.genre`).
 */
export type GenreToneKey = keyof typeof GENRE_TONES;

/**
 * Case-insensitive index over the tone table. A Map rather than the object
 * itself: a plain-object lookup answers `Object.prototype` members truthily,
 * so a genre named "constructor" would resolve to a function and the caller
 * would read `.color` off it as undefined. Genre is arbitrary server text and
 * an MD can create one by typing it, so that input is reachable.
 */
const GENRE_TONE_BY_NAME = new Map<string, Tone>(
  Object.entries(GENRE_TONES).map(([name, tone]) => [name.toLowerCase(), tone])
);

/**
 * Resolve any genre value — missing, or one with no designed color — to its
 * tone. Matching is case- and whitespace-insensitive so the filter chips and
 * the result chips agree on a genre however the server cased it. A miss
 * degrades the chip's color only; the genre text beside it is untouched.
 */
export function genreTone(genre: string | null | undefined): Tone {
  const key = genre?.trim().toLowerCase();
  return (key ? GENRE_TONE_BY_NAME.get(key) : undefined) ?? GENRE_TONES.Unknown;
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
