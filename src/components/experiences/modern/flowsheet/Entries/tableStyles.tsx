import type { SxProps } from "@mui/joy/styles/types";

// Below Joy's `sm` breakpoint (600px), flowsheet tables render as stacked
// cards instead of tables (only one layout mounts at a time).
export const FLOWSHEET_MOBILE_QUERY = "(max-width: 599.95px)";

// Joy's `xl` breakpoint (1536px): above it artist/label get their own
// columns, below it they stack into title/album as second lines. Must stay
// in lock-step with the `{ xs, xl }` values in FLOWSHEET_TABLE_SX below.
export const FLOWSHEET_XL_QUERY = "(min-width: 1536px)";

// Page-background gutter left of the tables that drag grips hang into
// without moving the tables; InfiniteScroller defines this variable via a
// negative-margin + equal-padding bleed (full width where Main's own padding
// absorbs it, narrower below md).
export const FLOWSHEET_DRAG_GUTTER_VAR = "--flowsheet-drag-gutter";
export const FLOWSHEET_DRAG_GUTTER_PX = 36;
export const FLOWSHEET_DRAG_GUTTER_NARROW_PX = 16;

// Fixed column widths shared between the entries/queue tables and the entry
// bar's field grid (FlowsheetSearchbar): the bar renders its inputs on this
// exact template so they align with the columns below as de-facto headers.
// Change these only in lock-step with FLOWSHEET_TABLE_SX's breakpoints.
export const FLOWSHEET_COL_ART_PX = 60;
export const FLOWSHEET_COL_ACTIONS_PX = 150;
export const FLOWSHEET_CELL_PADDING_X = "12px";

// Shared row/hover/action treatment for the entries and queue tables. The
// queue never renders a `row-playing` row, so those rules are inert there.
export const FLOWSHEET_TABLE_SX: SxProps = {
  borderCollapse: "separate",
  borderSpacing: "0 4px",
  "--TableCell-paddingX": FLOWSHEET_CELL_PADDING_X,
  // See FLOWSHEET_XL_QUERY: below xl these columns hide and reflow into
  // title/album as second lines (SongEntry).
  "& .col-artist, & .col-label": {
    display: { xs: "none", xl: "table-cell" },
  },
  "& tbody tr > td": {
    backgroundColor: "var(--row-bg, transparent)",
    transition: "background-color 120ms",
  },
  "& tbody tr.row-plain:hover > td": {
    backgroundColor: (theme) => theme.vars.palette.background.level1,
  },
  "& tbody tr:not(.row-plain):hover": { filter: "brightness(1.05)" },
  "& tbody tr.row-playing > td": {
    // Per-cell fill (so ends can round) leaves a hairline of page showing
    // through seams between cells at fractional widths. The two zero-blur
    // horizontal shadows extend each cell's fill 1px left/right to bridge
    // those seams (no vertical offset, so the 4px row gaps stay clean), and
    // come first so they paint over the drop shadow's side bleed. The clip
    // keeps the drop shadow to the bottom edge (an unclipped top would
    // re-draw seams) with -1px insets so the seam bridge isn't clipped away.
    boxShadow:
      "1px 0 0 var(--row-bg), -1px 0 0 var(--row-bg), 0 6px 12px -4px rgba(0, 0, 0, 0.35)",
    clipPath: "inset(0 -1px -12px -1px)",
  },
  // The drag grip anchors in the left gutter, so this cell's clip must open
  // further left or the now-playing row's grip gets clipped off.
  "& tbody tr.row-playing > td:first-of-type": {
    clipPath: `inset(0 -1px -12px -${FLOWSHEET_DRAG_GUTTER_PX + 8}px)`,
  },
  "& tbody tr.row-playing .row-actions > *": { opacity: 1 },
  "& tbody tr > td:first-of-type": {
    borderTopLeftRadius: "8px",
    borderBottomLeftRadius: "8px",
  },
  "& tbody tr > td:last-of-type": {
    borderTopRightRadius: "8px",
    borderBottomRightRadius: "8px",
  },
  // The action bar has no background of its own, so it shows the row
  // straight through with no patch that could read as a seam. Controls are
  // revealed on hover/focus on pointer devices, always visible on touch;
  // row-actions-persist (e.g. an activated request phone) opts out of hiding.
  "@media (hover: hover)": {
    "& tbody tr .row-actions > :not(.row-actions-persist)": {
      opacity: 0,
      transition: "opacity 120ms",
    },
    "& tbody tr:hover .row-actions > *, & tbody tr:focus-within .row-actions > *":
      {
        opacity: 1,
      },
    "& tbody tr .drag-grip": {
      opacity: 0,
      transition: "opacity 120ms",
    },
    "& tbody tr:hover .drag-grip, & tbody tr:focus-within .drag-grip": {
      opacity: 1,
    },
  },
};

// Column sizing only (rendered inside a visibility-collapsed thead): art+drag
// | artist | title | album | label | status+actions (tubafrenzy reading
// order, artist before song — #820). Every row type must render exactly
// these 6 column units (4 below xl) or fixed-layout sizing silently degrades.
export function FlowsheetColumnSizingRow() {
  return (
    <tr>
      <td style={{ width: `${FLOWSHEET_COL_ART_PX}px` }}></td>
      <td className="col-artist"></td>
      <td></td>
      <td></td>
      <td className="col-label"></td>
      <td style={{ width: `${FLOWSHEET_COL_ACTIONS_PX}px` }}></td>
    </tr>
  );
}
