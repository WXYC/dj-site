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

/** Leading column width: narrow for a single query row, wider when AND/OR/NOT shows. */
export const CATALOG_SEARCH_OPERATOR_COL_SINGLE = "2.25rem";
export const CATALOG_SEARCH_OPERATOR_COL_MULTI = "4.25rem";

/** Horizontal inset for AND/OR/NOT operator select label in the leading column. */
export const CATALOG_SEARCH_LEADING_INSET = 0.75;

/** Trailing add/remove control column. */
export const CATALOG_SEARCH_ACTION_COL = "1.75rem";

/** Fixed width so IN + field align on every query row. */
export const CATALOG_IN_FIELD_CLUSTER_WIDTH = "8rem";

export const CATALOG_SEARCH_ROW_GRID_TRANSITION =
  "grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

export function catalogSearchOperatorColWidth(multiRow: boolean): string {
  return multiRow
    ? CATALOG_SEARCH_OPERATOR_COL_MULTI
    : CATALOG_SEARCH_OPERATOR_COL_SINGLE;
}

export function catalogSearchRowColumnsSx(operatorCol: string): SxProps {
  return {
    gridTemplateColumns: `${operatorCol} minmax(0, 1fr) ${CATALOG_IN_FIELD_CLUSTER_WIDTH} ${CATALOG_SEARCH_ACTION_COL}`,
  };
}

/** Divider between query rows (Joy Divider `my: 0.25` plus 1px rule). */
export const CATALOG_SEARCH_ROW_DIVIDER_REM = 0.5625;

export const CATALOG_SEARCH_ROWS_PADDING_SINGLE_REM = 0.5;
export const CATALOG_SEARCH_ROWS_PADDING_MULTI_REM = 0.75;

export const CATALOG_SEARCH_ROWS_TRANSITION =
  "height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding-block 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

/** Per query row line (input + grid alignment). */
export const SEARCH_ADVANCED_ROW_HEIGHT_REM = 2.125;

/** Total block height for the query-rows area (padding + rows + dividers). */
export function catalogSearchRowsHeightRem(rowCount: number): number {
  const count = Math.max(1, rowCount);
  const padding =
    count > 1
      ? CATALOG_SEARCH_ROWS_PADDING_MULTI_REM
      : CATALOG_SEARCH_ROWS_PADDING_SINGLE_REM;
  const dividers =
    count > 1 ? (count - 1) * CATALOG_SEARCH_ROW_DIVIDER_REM : 0;
  return padding + count * SEARCH_ADVANCED_ROW_HEIGHT_REM + dividers;
}

export function catalogSearchRowsAnimatedSx(rowCount: number) {
  const multiRow = rowCount > 1;
  return {
    pl: 0.75,
    pr: 0.5,
    height: `${catalogSearchRowsHeightRem(rowCount)}rem`,
    minHeight: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    paddingBlock: multiRow ? "0.375rem" : "0.25rem",
    transition: CATALOG_SEARCH_ROWS_TRANSITION,
  };
}

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

export const catalogSearchLeadingSlotSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  minWidth: 0,
} as const;

export const catalogSearchIconLeadingSlotSx = {
  ...catalogSearchLeadingSlotSx,
  width: "100%",
  boxSizing: "border-box",
  justifyContent: "center",
} as const;

export const catalogSearchOperatorSelectButtonSx = {
  justifyContent: "flex-start",
  px: CATALOG_SEARCH_LEADING_INSET,
} as const;

export const catalogSearchInputSlotSx = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  gap: 0.5,
} as const;

export const catalogSearchActionSlotSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: CATALOG_SEARCH_ACTION_COL,
  minWidth: CATALOG_SEARCH_ACTION_COL,
  flexShrink: 0,
} as const;

export const catalogSearchIconSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
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
  display: "grid",
  alignItems: "center",
  columnGap: 0.5,
  flex: "0 0 auto",
  minWidth: 0,
  minHeight: 0,
  transition: CATALOG_SEARCH_ROW_GRID_TRANSITION,
} as const;

/** Fade-in for rows revealed as the query block height expands. */
export const catalogSearchRowRevealSx: SxProps = {
  animation: "catalogSearchRowReveal 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  "@keyframes catalogSearchRowReveal": {
    from: { opacity: 0.35 },
    to: { opacity: 1 },
  },
};
