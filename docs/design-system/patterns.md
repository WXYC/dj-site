# Patterns

Reusable shapes for building screens. The Rotation Shelf (`src/components/experiences/modern/admin/rotation/shelf/`) implements all of them.

## Record table

The default shape for any list of records.

- A Joy `Table` with `stickyHeader` and `hoverRow`, inside an outlined `Sheet` that owns the scroll (`flex: 1; minHeight: 0; overflow: auto`).
- Spread `recordTableSx(ROW_HEIGHT.mediaTall)` into the table's `sx`. It gives centered fixed-height rows, the level1 hover fill, the focus rail, the zero-width sticky actions cell, and the ghost-actions reveal. Mark rows with `className="record-row"`.
- **Row anatomy, left to right:**
  1. artwork (`RecordArtwork`);
  2. title (`title-sm`) over artist (`body-sm`, `text.secondary`), each with a 2-line clamp;
  3. meta cells (location pill, `tabularNumsSx` numbers);
  4. a caption-chip zone;
  5. `<td className="actions-cell">`, holding a `Stack className="row-actions"` with `rowActionsClusterSx`.
- **Grouping:** when the physical shelf groups records (by bin, by card), render one `tbody` per group, headed by a sticky strip row in the group's color. Strips read in uppercase with counts, e.g. "HEAVY · 13 · 3 overdue".
- A row is focusable (`tabIndex={0}`) and has an accessible name. Enter opens its detail.
- **Location beats code:** a rotating record shows `RotationLocationPill` (bin + card) where the call number would be, because the call number points at an empty shelf slot.

## Ghost actions

The contract, implemented by `recordTableSx` and `GHOST_ACTIONS_HIDE_QUERY`:

1. **Visible by default.** Hidden only under `@media (hover: hover) and (pointer: fine)`.
2. **Revealed** on row `:hover` and `:focus-within`, with a 120ms opacity fade.
3. **While hidden:** `pointer-events: none`. An invisible button must never be clickable.
4. **The cluster floats** over the row's right edge on a fade-to-hover-color backdrop. It never reserves a column.
5. **Toggles that are on stay visible** (flowsheet segue/request).
6. **Buttons:** `size="sm"` `variant="plain"` IconButtons, each in a Joy Tooltip, colored by role:
   - neutral for info, open and move;
   - `success` for queue and restore;
   - `primary` for play;
   - `warning` for retire and remove.
7. **Every per-row control's `aria-label` names its row**, e.g. `Retire: <album>` or `Move: <album>`. A list of identical icon buttons is otherwise meaningless to a screen reader.

## Menus

- **One component for both paths.** The row's context menu (right-click, the Menu key, or Shift+F10 on a focused row) and its Move/⋯ button open the same menu, scoped to all actions or to one section.
- **Built on Joy `MenuList`** inside a portalled MUI `Popper` + `ClickAwayListener`, with `variant="outlined" size="sm"`, `boxShadow: "md"`, `bgcolor: "background.popup"`, and a minimum width of about 220px.
- **Item order:** neutral items, then role-gated sections under `ListSubheader`s (`Move to bin`, `Card within Heavy`), then a `ListDivider`, then destructive items **last** (`warning`). The current choice is disabled and shows a `Check`.
- **Disabled items explain themselves** with secondary text in the item, never a native `title=`.
- **Joy gotchas:**
  - **Focus:** `MenuList` used without a `Dropdown` never takes focus, so Escape and the arrow keys never reach it. Pass the ref from `useMenuFocus(trigger)`. It focuses the first enabled item after Joy's roving focus settles, falls back to the list itself when every item is disabled, and returns focus to the trigger on close.
  - **No Fragments:** `MenuList` stamps first-/last-child props onto its direct children, so a `Fragment` there throws a console error. Build the items as one flat, keyed array.
  - **Escape and Tab** close the menu (an `onKeyDown` on the list).

## Chips

| Kind | Variant | Notes |
|---|---|---|
| Descriptor (genre, format) | `soft` | Caption scale (`STATUS_CHIP_SX`), never capped with "+N" |
| Operational status (rotation bin, Exclusive) | `solid` | Bin colors via `rotationBinSx(bin, "solid")` |
| Filter / choosable target | `soft`, `solid` when selected | `aria-pressed` on the action slot. Bin filters use `rotationBinSx`. |
| Link or secondary toggle | `outlined` | |

- **Clicks bubble:** clicking a chip in a row still opens the row.
- **Accessible names:** Joy points a clickable chip's action at its visible label through `aria-labelledby`, which overrides an `aria-label`. When the visible text is abbreviated (`H 13`), pass both `"aria-label": "Heavy (13)"` and `"aria-labelledby": undefined` in `slotProps.action`.

**Location pill.** `RotationLocationPill` is the bin letter followed by a `RotationCardBadge` at its usual 1.6em size, riding flush against the pill's right end like a slider's knob. The pill keeps only its left padding and hugs the badge with a 2px inset. The pill is focusable, its Joy Tooltip carries the card's name, and its accessible name is the full sentence ("Heavy rotation, card 2 'Jazz'").

## Dialogs

Use `ConfirmDialog` for both kinds:
- `role="alertdialog"` (the default) when it asks for a decision;
- `role="dialog"` when it hosts work the user carries on with (card assignment, replacement windows).

Its `actions` slot takes the caller's own buttons.

- **Every button label names its act**, e.g. "Clear bin", "Discard 6 moves", "Save windows". Never Yes/OK/Confirm.
- **Initial focus goes to the safe choice** (`autoFocus` on Cancel / "Keep ticking").
- **Dismissal is blocked while the action runs** (`pending`).
- **Never `window.confirm()`.**

URL state opens a dialog when it should be linkable or restorable. For example, `?windows=1` opens the replacement windows.

## Destructive actions

| Tier | Examples | Treatment |
|---|---|---|
| **Reversible, single item** | Retire from rotation, remove from the mail bin, unqueue | No dialog. A plain `warning` icon button is fine. After success, a toast with **Undo** (sonner `toast(msg, { action: { label: "Undo", onClick } })`) that calls the inverse. |
| **Bulk or hard to reverse** | Clear the mail bin, discard a batch of unsaved moves | `ConfirmDialog` with a count-aware title, a button that names the act, a warning icon or tone (not color alone), and focus on the safe choice. |
| **Irreversible** | Delete a rotation card | Only from a menu, labelled with what it deletes ("Delete Heavy 4"), never icon-only. Disabled with its rule stated when not allowed. |

Destructive actions use `warning`, not a panic color. There is no red on The Stacks.

## Loading

| Duration | Show |
|---|---|
| Under ~1s | Nothing new |
| 1–10s, page or table | Skeleton rows shaped like the real rows (same heights and gaps) |
| 1–10s, a region refreshing | The always-mounted spinner overlay, with the content dimmed to .35 |
| A button's own write | Joy `loading` on that button |
| A batch with known size | A determinate `LinearProgress` (e.g. "4 / 6" in its aria-label) |

- **No visible status text, ever.** No "Searching…", "Loading…" or "Checking rotation status…". A few older strings remain; don't add more, and replace them when you touch them.
- **Always pair a loading state with screen-reader words.** Mount one `StatusRegion` per surface unconditionally and vary only its `message` ("Loading rotation" → "36 active records"). Set `aria-busy` on the region being updated.
- **Never render an empty state before the read settles.** Treat absence of data, not the `isError` flag, as an outage: a failed background refetch must not blank a list that is already showing.

## Empty and error states

- **Empty:** one quiet line in the house voice, plus one next step ("Nothing on this shelf matches." + Clear filters).
- **Error:** near its source, blame-free, always with a remedy (`ReadRetryAlert` with Retry, or a next step in words: "Your saved records are safe — check your connection and try again"). An outage is never drawn as "there are none". When a read the view is made of has failed, show only the retry, not an empty frame with live controls.
- Keep "unreachable" and "empty" visibly distinct.

## Forms

- Joy `FormControl` + `FormLabel` + `FormHelperText`. Errors go through the control's `error` state and helper text, not hand-colored `Typography`.
- **One `solid` button per form.** It is the submit, colored by role (`success` for an MD write), and labelled with the act ("Add to rotation", "File to library", "Save windows").
- Secondary helpers ("Fill from Discogs") are `soft` or `plain`.
- **Write preconditions fail closed.** A form seeded from a read only renders once that read succeeds, and submit stays disabled while a required read is missing.
