import type { SxProps } from "@mui/joy/styles/types";

/**
 * Outlined search shell — border from Joy `Sheet variant="outlined"`.
 * Padding lives on the query rows block; filters sit in the gutter below.
 */
export const catalogSearchBoxSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  zIndex: 1,
  borderRadius: "md",
  p: 0,
  overflow: "hidden",
  cursor: "text",
  bgcolor: "background.surface",
  "& input": {
    background: "transparent !important",
    outline: "none !important",
    border: "none !important",
    fontFamily: "inherit !important",
    fontSize: "var(--joy-fontSize-sm)",
    lineHeight: 1.25,
    minWidth: "0 !important",
    px: 0.75,
    py: 0,
    flex: 1,
    minHeight: 0,
    height: "1.5rem",
    cursor: "text",
  },
  "&:focus-within": {
    borderColor: "var(--joy-palette-primary-300)",
    boxShadow: "0 0 0 2px var(--joy-palette-primary-100)",
  },
};

export const catalogSearchRowsSx: SxProps = {
  pl: 0.75,
  pr: 0.5,
};

/** Fixed width so IN + field align on every query row. */
export const CATALOG_IN_FIELD_CLUSTER_WIDTH = "8rem";

export const catalogInFieldClusterSx = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 0.375,
  width: CATALOG_IN_FIELD_CLUSTER_WIDTH,
  minWidth: CATALOG_IN_FIELD_CLUSTER_WIDTH,
  flexShrink: 0,
} as const;

export const catalogInLabelSx = {
  color: "text.tertiary",
  fontSize: "var(--joy-fontSize-xs)",
  lineHeight: 1,
  letterSpacing: "0.04em",
  userSelect: "none",
  flexShrink: 0,
} as const;

export const catalogFieldSelectButtonSx = {
  color: "text.tertiary",
  fontSize: "var(--joy-fontSize-xs)",
  lineHeight: 1,
  letterSpacing: "0.04em",
  fontWeight: 500,
  minHeight: 0,
  py: 0,
  px: 0,
  flex: 1,
  minWidth: 0,
  justifyContent: "flex-start",
  "--Button-minHeight": "1.25rem",
  whiteSpace: "nowrap",
  border: "none",
  bgcolor: "transparent",
  boxShadow: "none",
  "&:hover": {
    bgcolor: "transparent",
    boxShadow: "none",
  },
} as const;

export const catalogFieldSelectSx = {
  flex: 1,
  minWidth: 0,
  "--Select-gap": "0.125rem",
} as const;

export const catalogSearchIconSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  ml: 0.75,
  mr: 0.25,
  pointerEvents: "none",
  "& svg": {
    fill: "var(--wxyc-palette-neutral-400) !important",
  },
} as const;

/** Muted seam between query rows and filter gutter (softer than outer sheet border). */
export const catalogSearchFiltersGutterSx: SxProps = {
  px: 0.5,
  py: 0.375,
  minHeight: "2rem",
  flexShrink: 0,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
  width: "100%",
};

export const catalogSearchRowSx = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flex: "0 0 auto",
  minWidth: 0,
  minHeight: 0,
  gap: 0.5,
} as const;

/** Per advanced row when 2+ query lines are shown. */
export const SEARCH_ADVANCED_ROW_HEIGHT_REM = 2.125;
