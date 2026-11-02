import type { SxProps } from "@mui/joy/styles/types";

/** Row heights, by what the row carries. A row exceeds 48px only for artwork or two lines. */
export const ROW_HEIGHT = {
  marker: 40,
  media: 60,
  mediaTall: 68,
} as const;

/**
 * The ghost-actions contract: actions are visible by default and hidden only
 * where the primary pointer can hover precisely, revealed on row hover or
 * keyboard focus within the row. A hidden cluster takes no pointer events, so
 * it can never be clicked while invisible.
 */
export const GHOST_ACTIONS_HIDE_QUERY = "@media (hover: hover) and (pointer: fine)";

/**
 * Shared `sx` for a media-object record table (Joy `Table`): centered
 * fixed-height rows, a level1 hover fill, a zero-width sticky actions cell
 * pinned to the scroll container's right edge, and the ghost-actions reveal.
 * Rows mark their actions cluster with `.row-actions` and the cell with
 * `.actions-cell`.
 */
export function recordTableSx(rowHeight: number): SxProps {
  return {
    "--TableCell-headBackground": (theme) => theme.vars.palette.background.level1,
    "--Table-headerUnderlineThickness": "1px",
    "--TableRow-hoverBackground": (theme) => theme.vars.palette.background.level1,
    "& tbody tr.record-row > td": {
      height: `${rowHeight}px`,
      verticalAlign: "middle",
    },
    "& tbody tr.record-row:focus-visible": {
      outline: "none",
    },
    "& tbody tr.record-row:focus-visible > td:first-of-type": {
      boxShadow: (theme) => `inset 2px 0 0 ${theme.vars.palette.primary[500]}`,
    },
    "& tbody tr > td.actions-cell": {
      position: "sticky",
      right: 0,
      zIndex: 3,
      width: 0,
      minWidth: 0,
      maxWidth: 0,
      padding: 0,
      overflow: "visible",
      background: "transparent",
    },
    "& tbody tr .row-actions": {
      background:
        "linear-gradient(to right, transparent, var(--TableRow-hoverBackground) 18px)",
    },
    [GHOST_ACTIONS_HIDE_QUERY]: {
      "& tbody tr .row-actions": {
        opacity: 0,
        pointerEvents: "none",
        transition: "opacity 120ms",
      },
      "& tbody tr:hover .row-actions, & tbody tr:focus-within .row-actions": {
        opacity: 1,
        pointerEvents: "auto",
      },
    },
  };
}

/** The cluster's own placement inside the zero-width actions cell. */
export const rowActionsClusterSx = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  borderRadius: "sm",
  pl: 3,
  pr: 0.5,
} as const;

/** Times, counts, and ages align in columns. */
export const tabularNumsSx = { fontVariantNumeric: "tabular-nums" } as const;
