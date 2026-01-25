import type { ColorPaletteProp, VariantProp } from "@mui/joy";
import type { RotationBin, Genre, Format } from "@wxyc/shared";

/**
 * Semantic Color Token System
 *
 * This module provides meaningful, domain-specific color abstractions while
 * maintaining backwards compatibility with MUI Joy's color system.
 *
 * Benefits:
 * - Single source of truth for all color decisions
 * - Type safety (TypeScript catches invalid color usage at compile time)
 * - Consistency across the codebase
 * - Semantic clarity in code
 */

// =============================================================================
// TYPES
// =============================================================================

/** Semantic color result with optional variant */
export interface SemanticColor {
  color: ColorPaletteProp;
  variant?: VariantProp;
}

// =============================================================================
// ROTATION COLORS - Single source of truth
// =============================================================================

/**
 * Rotation bin colors indicate radio station rotation frequency.
 * - H (Heavy): High rotation, most played - danger (red, attention-grabbing)
 * - M (Medium): Medium rotation - warning (yellow/amber)
 * - L (Light): Light rotation - success (green)
 * - S (Special): Special rotation - primary (blue, distinctive)
 */
const ROTATION_COLORS: Record<RotationBin, ColorPaletteProp> = {
  H: "danger",
  M: "warning",
  L: "success",
  S: "primary",
};

/** Get the color for a rotation bin */
export function getRotationColor(bin: RotationBin): ColorPaletteProp {
  return ROTATION_COLORS[bin];
}

/** Backwards compatibility export */
export const RotationStyles = ROTATION_COLORS;

// =============================================================================
// GENRE COLORS
// =============================================================================

/**
 * Genre colors categorize music by genre.
 * Each genre has both a color and variant for visual distinction.
 */
const GENRE_COLORS: Record<Genre, SemanticColor> = {
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

/** Get the color and variant for a genre */
export function getGenreColor(genre: Genre): SemanticColor {
  return GENRE_COLORS[genre] ?? GENRE_COLORS.Unknown;
}

// =============================================================================
// FORMAT COLORS
// =============================================================================

/**
 * Format colors distinguish physical media types.
 * - Vinyl: primary (blue, classic/premium)
 * - CD: warning (amber, standard)
 * - Unknown/Digital: neutral (gray)
 */
const FORMAT_COLORS: Record<Format, ColorPaletteProp> = {
  Vinyl: "primary",
  CD: "warning",
  Unknown: "neutral",
};

/** Get the color for a format */
export function getFormatColor(format: Format): ColorPaletteProp {
  return FORMAT_COLORS[format] ?? FORMAT_COLORS.Unknown;
}

// =============================================================================
// ENTRY TYPE COLORS
// =============================================================================

/** Flowsheet entry types */
export type FlowsheetEntryType =
  | "startShow"
  | "endShow"
  | "talkset"
  | "breakpoint"
  | "message";

/**
 * Entry type colors differentiate flowsheet entry types.
 * - startShow: success (green, positive start)
 * - endShow: primary (blue, completion)
 * - talkset: danger (red, attention/break)
 * - breakpoint: warning (amber, marker)
 * - message: warning (amber, informational)
 */
const ENTRY_TYPE_COLORS: Record<FlowsheetEntryType, ColorPaletteProp> = {
  startShow: "success",
  endShow: "primary",
  talkset: "danger",
  breakpoint: "warning",
  message: "warning",
};

/** Get the color for a flowsheet entry type */
export function getEntryTypeColor(type: FlowsheetEntryType): ColorPaletteProp {
  return ENTRY_TYPE_COLORS[type];
}

// =============================================================================
// ACTION COLORS
// =============================================================================

/**
 * Action colors indicate interactive element intent.
 * Use these for buttons and clickable elements.
 */
export const ActionColors = {
  /** Main CTA (submit, save) */
  primary: "primary" as const,
  /** Secondary actions */
  secondary: "neutral" as const,
  /** Delete, remove */
  destructive: "danger" as const,
  /** Add, create */
  constructive: "success" as const,
};

// =============================================================================
// STATUS COLORS
// =============================================================================

/**
 * Status colors indicate current state of UI elements.
 */
export const StatusColors = {
  /** Currently playing track */
  playing: "primary" as const,
  /** Track in queue */
  queued: "success" as const,
  /** Not active/playing */
  inactive: "neutral" as const,
  /** Show is live */
  live: "primary" as const,
  /** Show is offline */
  offline: "neutral" as const,
  /** Item is selected */
  selected: "primary" as const,
};

// =============================================================================
// FEEDBACK COLORS
// =============================================================================

/**
 * Feedback colors communicate operation results.
 */
export const FeedbackColors = {
  /** Operation succeeded */
  success: "success" as const,
  /** Operation failed */
  error: "danger" as const,
  /** Caution/attention needed */
  warning: "warning" as const,
};
