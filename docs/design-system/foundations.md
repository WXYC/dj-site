# Foundations

Color, type, density, elevation, motion, icons. Each section gives the rule, then where it lives in code.

## Color

### Three tiers

| Tier | Holds | Lives in | Consumed by |
|---|---|---|---|
| **Base** | Raw scales (`ROSE`, `TEAL`, `STONE`, `VINYL_GOLD`, …) | `themes/definitions.ts` | Theme definitions only |
| **Palette** | Joy's five slots plus WXYC slots: `sidebar`, `sidebarAdmin`, `formatVinyl`, `formatCd`, `exclusive`, `onAir`, `rotation.{heavy,medium,light,singles}`, `background.{body,surface,popup,border}` | Each `ThemeDefinition` | The role tier, and Joy `color=` props through it |
| **Role** | A domain meaning → `{ color, variant }` or ready-made `sx` | `tokens/roles.ts` | **Components** |

**Rule:** a component picks color by *role*, never by a hex value, an `rgba()` literal, or the English meaning of a Joy slot name. Older code still has a few literals; don't copy them, and don't add new ones.

### Joy's slot names are hues, not meanings

On The Stacks (the default theme) the slots carry:

| Slot | Hue |
|---|---|
| `primary` | rose |
| `success` | teal |
| `warning` | **stone** — a neutral, not amber |
| `danger` | **fuchsia** in light, **indigo** in dark — not red |
| `neutral` | warm greige |

The slots are reused rather than replaced because Joy drops its global variants for custom palette names. The cost is that `color="danger"` does **not** mean "alarm" here. Choose a color by looking up its role below; never by what the slot name suggests.

### Role assignments

| Meaning | Tone | Where |
|---|---|---|
| Genre | `GENRE_TONES` / `genreTone()`: descriptive, mostly `soft` | `roles.ts` |
| Format | `formatVinyl` gold / `formatCd` slate, `soft`, via `formatTone()` (substring match) | `roles.ts` |
| Rotation bin | `rotationBinSx(bin, "solid" \| "soft")` / `rotationBinColors(bin)`: the theme's `rotation` palette | `roles.ts` |
| Flowsheet entry type | `ENTRY_TONES`: start show `success`, end show `primary`, talkset `danger`, breakpoint `warning`, who's on `neutral`, all `soft` | `roles.ts` |
| Admin roles | `ADMIN_TONES` | `roles.ts` |
| Now playing | `primary` `solid`, plus the downward row shadow | flowsheet |
| Queued | `success` `soft` | flowsheet, bin |
| MD write affordance (add, save, file, restore) | `success` | everywhere an MD writes |
| Reversible removal (retire from rotation, remove from bin, clear the bin) | `warning` | everywhere |
| WXYC Exclusive | `exclusive` purple (`WXYC_EXCLUSIVE_PURPLE`) | chips |
| On air | `onAir` red dot + glow | header |

**Rotation bins have exactly one color source.** Every bin-colored surface — chips, avatar corner badges, filter chips, flowsheet chips, pickers, card badges, location pills, group headers — goes through `rotationBinSx` / `rotationBinColors`, which resolve to the theme's `--wxyc-palette-rotation-<slot>-*` variables. There is no `ROTATION_TONES`; don't reintroduce a second mapping. `solid` means "this record is in this bin"; `soft` means descriptive or a choosable target (a filter, a move destination).

### Color is never the only signal

- A rotation pill always shows its letter (H/M/L/S), not just its hue.
- Selected state pairs color with a second cue: a rail, a check, a border.
- A state change you show only by recoloring (a border going from primary to success) needs an icon or label change too.
- Chips carry text, which is why genre and format hues are safe as reinforcement.

### Contrast

- **4.5:1** for all text, including the 0.65rem caption chips and `text.tertiary`, in **every theme in both modes**.
- **3:1** for non-text elements that carry state: focus rings, selected borders, intent borders.
- Hover fills are supplemental and exempt.
- Where a soft fill is too faint, add a border rather than darkening the fill.

The rotation bin tokens were tuned to pass 4.5:1 for both their rest and solid pairs in all four themes. When you add or change a theme's `rotation` tokens, re-check every pair: bright fills (amber, cyan) take dark text, deep fills take white.

### Surfaces and elevation

- Three tonal steps: `body` (page) → `surface` (cards, panels, the rightbar) → `popup` (menus, modals, tooltips, raised rows). In dark mode each step is visibly lighter than the one below.
- Dark mode is warm charcoal (red > green > blue), never neutral black.
- Elevation is rare and always means something: the now-playing row's downward shadow, the floating hover-action cluster (`sm`), menus (`md`). Everything else is flat. Shadows barely read on dark surfaces, so pair them with a tonal step or a hairline border.
- Palettes are muted, Material-style hues rather than saturated defaults.

### Themes

Four themes, each named after a record or radio reference: **The Stacks** (`stacks`, default), **Blue Note** (`bluenote`), **Shellac** (`shellac`), **Deadstock** (`deadstock`). Theme ids match `^[a-z0-9]+$`. Adding a theme means adding one `ThemeDefinition` and registering it in `themes/registry.ts`. A theme must define every WXYC semantic slot; Joy built-ins may be omitted.

## Typography

| Set | Face | Weights | Used for |
|---|---|---|---|
| **Productive** | Kanit (+ a named CJK fallback stack) | 400 and 500 only | Every working surface |
| **Expressive** | Minbus | 100 | `h1`–`h4` page titles only |

- Every Joy weight token (`md`, `lg`, `xl`) is clamped to 500, because Kanit ships only 400 and 500 and anything heavier would be a synthesized bold. Don't set `fontWeight: 600/700`.
- **Row hierarchy:** title `title-sm` in `text.primary` · secondary fields `body-sm` in `text.secondary` · tertiary (alternate artist, label, times) in `text.tertiary` · second lines in folded cells `body-xs`.
- **Emphasis comes from weight, not color.** The sorted catalog column renders at 500 and the rest at 400.
- **Caption chips** use `STATUS_CHIP_SX`: 0.65rem, weight 500, 16px min height. This is the only size allowed below Joy's scale. Don't introduce other sub-scale sizes.
- **Numbers:** times, counts, ages, and plays use `tabularNumsSx` (`font-variant-numeric: tabular-nums`) and right-align in their column. Zero or missing numbers render as "—" in `text.tertiary`.
- **Monospace only for code-like strings** (call numbers), and those never truncate.
- **Uppercase labels** (section heads, bin strips) get letter-spacing of about 0.06–0.08em.

### Truncation

1. **Identity fields** (title, artist, album): 2-line clamp where space allows. A task must never depend on finding a tooltip.
2. **Secondary fields:** 1-line ellipsis plus a **Joy `Tooltip`** (`variant="outlined" size="sm"`) that also opens on keyboard focus.
3. **Never truncate** headers, labels, error copy, or call numbers.
4. **Never use the native `title=` attribute** for a tooltip. Touch, keyboard, and screen-reader users can't reliably reach it. Use a Joy Tooltip, and put the full text in the element's accessible name.

## Density and layout

Row heights live in `ROW_HEIGHT` (`recordTableSx.ts`):

| Token | Height | Used by | Why |
|---|---|---|---|
| `marker` | 40px | Flowsheet message rows, card group headers | Text-only rows |
| `media` | 60px | Flowsheet songs | Artwork + two lines |
| `mediaTall` | 68px | Catalog, Rotation Shelf | Artwork + 2-line clamp + chips |

- A row is taller than 48px only if it carries artwork or two lines. Row height tells the reader what kind of row it is.
- **Skeletons reuse the same row heights and gaps** as the rows they stand in for.
- **Artwork comes first** (52–64px), on the left. Every row gets an image: a missing cover becomes the genre-gradient + lettercode placeholder (`RecordArtwork`). That placeholder is acceptable because it carries information; a generic grey box is not.
- Columns follow importance order; headers are sticky; rows are separated (hover fill, or spacing in the flowsheet) rather than zebra-striped.
- The flowsheet's entry bar **is** its table header: one set of column constants drives the bar, the results, and the rows.
- Radius: Joy `md` (8px) for rows, sheets, and cards; `xl` for mobile flowsheet cards.

### Responsive fold

| Width | Behavior |
|---|---|
| ≥ `xl` | All columns |
| `sm`–`xl` | Secondary columns fold into two-line cells |
| Below a table's minimum width | Scroll horizontally rather than crush columns |
| < `sm` | Uniform list-like cards with fixed field positions; phones only |

### Page frame

`Main` is a fixed `100dvh` flex column with `overflow: hidden`. A page either fills it with a flex child (`flex: 1; minHeight: 0`) that owns its own scroll (the catalog and the shelf scroll their table inside an outlined `Sheet`, so toolbars stay put and headers stick), or wraps its content in `ScrollRegion`. A page that does neither gets clipped. Primary page actions sit in `PageHeader` beside the title, not in tab strips.

## Motion

| Use | Duration |
|---|---|
| Hover reveals, border and color changes | 120–150ms |
| Popovers, results panel (scale .97 → 1 + fade) | ~180ms |
| Layout changes (query builder, sidebar slide) | currently 400ms; keep new ones ≤ 300ms |

- Exits are no slower than entrances.
- Spinners stay **mounted** and toggle opacity, so their animation never restarts.
- Under `prefers-reduced-motion`, transforms, size changes, slides, and skeleton shimmer go instant or fade-only. Opacity and color fades may stay.

## Icons

- MUI Material icons, using the outlined variants where they exist (`InfoOutlined`, `EditOutlined`, …).
- `fontSize="small"` inside `size="sm"` IconButtons.
- **Icon pairs encode reversibility:** `Archive` ↔ `Unarchive` for adding to and removing from the mail bin; `RemoveCircleOutline` ↔ `RestoreOutlined` for retiring from and restoring to rotation; `DeleteSweep` / `DeleteOutline` only for a true delete.
