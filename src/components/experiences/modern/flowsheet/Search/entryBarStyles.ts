import {
  FLOWSHEET_COL_ACTIONS_PX,
  FLOWSHEET_COL_ART_PX,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import type { SxProps } from "@mui/joy/styles/types";
import type { Modifier } from "@popperjs/core";

/**
 * Wrap a transition-bearing sx fragment so it collapses under
 * prefers-reduced-motion. Lifted from the parked entry-redesign branch.
 */
export const withReducedMotion = (sx: Record<string, unknown>) => ({
  ...sx,
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

/**
 * The bar's field grid mirrors the entries table's column template
 * (FlowsheetColumnSizingRow: art | artist | title | album | label | actions)
 * so the inputs sit exactly over the columns below, reading as headers.
 * Below xl the table hides artist/label into second lines, so exact
 * alignment only exists at xl — the bar keeps all four fields visible on a
 * flexible template. Below sm the leading icon cell is dropped.
 */
export const ENTRY_BAR_GRID_TEMPLATE = {
  xs: `repeat(4, minmax(0, 1fr)) auto`,
  sm: `${FLOWSHEET_COL_ART_PX}px repeat(4, minmax(0, 1fr)) auto`,
  xl: `${FLOWSHEET_COL_ART_PX}px repeat(4, minmax(0, 1fr)) ${FLOWSHEET_COL_ACTIONS_PX}px`,
} as const;

/** Matches the tables' --TableCell-paddingX so text origins line up. */
export const ENTRY_BAR_CELL_PADDING_X = "12px";

/**
 * Shell border color: neutral at rest, primary while the search is active,
 * success while the next commit would queue (Ctrl/⌘ held). JS-driven (not
 * :focus-within) so the shell and the results panel — separate elements —
 * always agree and read as one continuous outlined shape.
 */
export function entryBarActiveBorder(
  active: boolean,
  ctrlKeyPressed: boolean
): string {
  if (!active) return "neutral.outlinedBorder";
  return ctrlKeyPressed ? "success.500" : "primary.500";
}

/**
 * Popper modifier: size the results panel to the shell's width so the two
 * edges are flush. Lifted from the parked entry-redesign branch.
 */
export const sameWidth: Modifier<"sameWidth", object> = {
  name: "sameWidth",
  enabled: true,
  phase: "beforeWrite",
  requires: ["computeStyles"],
  fn: ({ state }) => {
    state.styles.popper.width = `${state.rects.reference.width}px`;
  },
  effect: ({ state }) => {
    const reference = state.elements.reference;
    if (reference instanceof HTMLElement) {
      state.elements.popper.style.width = `${reference.offsetWidth}px`;
    }
  },
};

/**
 * Results panel Sheet: square top + no top border continues the shell's
 * squared bottom so the active outline flows down into the results box.
 * (Corner radius props don't map theme tokens — use the CSS var.)
 */
export const entryPanelSx = (activeBorder: string): SxProps => ({
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: "var(--wxyc-radius-md)",
  borderBottomRightRadius: "var(--wxyc-radius-md)",
  borderTop: "none",
  borderColor: activeBorder,
  ...withReducedMotion({ transition: "border-color 0.15s" }),
  boxShadow: "lg",
  maxHeight: "min(70vh, 460px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
});
