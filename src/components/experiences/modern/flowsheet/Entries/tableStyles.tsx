import type { SxProps } from "@mui/joy/styles/types";

// Below Joy's `sm` breakpoint (600px) the flowsheet tables render as stacked
// cards instead of tables. Only one layout is rendered at a time (not both
// CSS-hidden), so the list never mounts twice.
export const FLOWSHEET_MOBILE_QUERY = "(max-width: 599.95px)";

// Joy's `xl` breakpoint (1536px). Above it the artist and label get their own
// columns; below it they stack into the title/album cells as second lines.
// Must stay in lock-step with the `{ xs, xl }` responsive values in
// FLOWSHEET_TABLE_SX below — both describe the same column collapse.
export const FLOWSHEET_XL_QUERY = "(min-width: 1536px)";

// Shared row/hover/action treatment for the entries and queue tables. The
// queue never renders a `row-playing` row, so those rules are inert there.
export const FLOWSHEET_TABLE_SX: SxProps = {
  // Broadcast-log softening: separated rounded rows on lifted
  // surfaces instead of hard gridlines over pure black.
  borderCollapse: "separate",
  borderSpacing: "0 4px",
  "--TableCell-paddingX": "12px",
  // Below xl the artist and label collapse into two-line title/album
  // cells (see SongEntry), so their standalone columns are hidden and
  // the remaining columns widen to fit the reflowed text.
  "& .col-artist, & .col-label": {
    display: { xs: "none", xl: "table-cell" },
  },
  "& tbody tr > td": {
    backgroundColor: "var(--row-bg, transparent)",
    transition: "background-color 120ms",
  },
  // Ordinary play rows sit nearly flush and lift on hover; colored
  // rows (playing, markers) just brighten slightly.
  "& tbody tr.row-plain:hover > td": {
    backgroundColor: (theme) => theme.vars.palette.background.level1,
  },
  "& tbody tr:not(.row-plain):hover": { filter: "brightness(1.05)" },
  // The current play lifts off the log for depth and keeps its
  // controls available without hover.
  "& tbody tr.row-playing > td": {
    boxShadow: "0 6px 12px -4px rgba(0, 0, 0, 0.35)",
    // Keep only the downward shadow: side bleed draws seams between
    // the row's cells.
    clipPath: "inset(0 0 -12px 0)",
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
  // Legibility backdrop between the action icons and the status chips they
  // overlay. Applied whenever the actions are visible at rest — a persisted
  // control (activated request/segue), the always-revealed playing row —
  // not just on hover; hover/focus reveal below adds it for the rest.
  // `--row-backdrop` (set by DraggableEntryWrapper) is an opaque surface
  // color even for near-transparent plain rows, so the mask actually masks.
  "& tbody tr .row-actions:has(.row-actions-persist), & tbody tr.row-playing .row-actions":
    {
      background:
        "linear-gradient(to right, transparent, var(--row-backdrop) 18px)",
    },
  // Controls stay quieter than the music identity: revealed on row
  // hover/focus on pointer devices, always visible on touch. A control
  // marked row-actions-persist (e.g. an activated request phone) stays
  // visible without hover.
  "@media (hover: hover)": {
    "& tbody tr .row-actions > :not(.row-actions-persist)": {
      opacity: 0,
      transition: "opacity 120ms",
    },
    "& tbody tr:hover .row-actions > *, & tbody tr:focus-within .row-actions > *":
      {
        opacity: 1,
      },
    "& tbody tr:hover .row-actions, & tbody tr:focus-within .row-actions": {
      background:
        "linear-gradient(to right, transparent, var(--row-backdrop) 18px)",
    },
  },
  // Touch devices skip the reveal entirely, so the actions (always visible)
  // always carry the backdrop.
  "@media (hover: none)": {
    "& tbody tr .row-actions": {
      background:
        "linear-gradient(to right, transparent, var(--row-backdrop) 18px)",
    },
  },
};

// Column sizing only (rendered inside a visibility-collapsed thead): art+drag
// | title | artist | album | label | status+actions. Every row type must
// render exactly these 6 column units (4 below xl, where the artist and
// label columns collapse) or fixed-layout sizing silently degrades.
export function FlowsheetColumnSizingRow() {
  return (
    <tr>
      <td style={{ width: "60px" }}></td>
      <td></td>
      <td className="col-artist"></td>
      <td></td>
      <td className="col-label"></td>
      <td style={{ width: "150px" }}></td>
    </tr>
  );
}
