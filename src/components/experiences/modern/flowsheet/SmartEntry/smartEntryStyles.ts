import type { SxProps } from "@mui/joy/styles/types";
import type { ColorPaletteProp } from "@mui/joy";
import type { SmartField } from "./parser/types";

/**
 * Which Joy palette a detected field's token is tinted with. `song` (the
 * always-leading field) stays plain — no pill — so the common case reads as
 * ordinary text. Kept subtle per the brief (Todoist-like, not a tag editor).
 * NOTE: a visual choice worth a screenshot review.
 */
export const SMART_ENTRY_FIELD_COLOR: Record<
  SmartField,
  ColorPaletteProp | "plain"
> = {
  song: "plain",
  artist: "primary",
  album: "success",
  label: "warning",
};

/**
 * The exact text metrics shared by BOTH the textarea and its mirror layer.
 * They MUST be identical — including a single uniform font-weight — or the
 * highlighted mirror drifts out of alignment with the (transparent) textarea
 * caret. Tokens are differentiated by background/colour only, never weight.
 */
export const smartEntryTextMetricsSx = {
  // `inherit` (not a raw var) so the textarea — which otherwise uses the UA
  // form-control font — matches the mirror's inherited body font exactly; and
  // the `sm` token maps through Joy's cssVarPrefix. Both must resolve
  // identically on the two layers or the highlights drift off the caret.
  fontFamily: "inherit",
  fontSize: "md",
  fontWeight: 500,
  lineHeight: 1.7,
  letterSpacing: "0",
  fontVariantLigatures: "none",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  tabSize: 4,
};

/** Padding/box shared by both layers so glyph origins coincide. */
export const smartEntryBoxSx = {
  boxSizing: "border-box",
  m: 0,
  px: 1.25,
  py: 1,
  border: "none",
};

/** Soft token pill for a detected/locked field value in the mirror. */
export function smartEntryTokenSx(
  field: SmartField,
  locked: boolean
){
  const color = SMART_ENTRY_FIELD_COLOR[field];
  if (color === "plain") {
    return { color: "text.primary" };
  }
  return {
    color: `${color}.softColor`,
    // A locked constraint reads a touch firmer than a passive detection. Both
    // use Joy palette tokens (prefix-safe) rather than raw CSS vars — the app
    // sets cssVarPrefix "wxyc", so hardcoded --joy-* vars never resolve.
    bgcolor: locked ? `${color}.softActiveBg` : `${color}.softBg`,
    borderRadius: "4px",
    // Tiny horizontal padding compensated by negative margin → net-zero glyph
    // advance, so the pill decorates without shifting the caret.
    px: "3px",
    mx: "-3px",
  };
}

/** Dimmed trigger word ("by", "on", …) styling in the mirror. */
export const smartEntryTriggerSx = {
  color: "text.tertiary",
};

/** Grey ghost-completion suffix (added only in the mirror; aria-hidden). */
export const smartEntryGhostSx = {
  color: "text.tertiary",
  opacity: 0.7,
};

/**
 * Wrap an animated sx so it collapses to no motion when the viewer prefers
 * reduced motion. This is the app's first reduced-motion handling — exported so
 * the results-panel expand/collapse (and, later, the catalog box) can reuse it.
 */
export function withReducedMotion(animatedSx: SxProps): SxProps {
  return {
    ...(animatedSx as object),
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
      animation: "none",
    },
  } as SxProps;
}
