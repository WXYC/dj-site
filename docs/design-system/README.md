# Modern experience design system

The design language of the modern experience, written down from the surfaces that define it: the **Card Catalog**, the **Flowsheet**, the **Mail Bin**, and the **Rotation Shelf** built in their image. Read this before building or restyling any modern screen. Classic mode is out of scope: it copies tubafrenzy deliberately and stays bare.

| File | Read it when you are… |
|---|---|
| [`foundations.md`](foundations.md) | choosing a color, variant, type level, row height, motion duration, or icon |
| [`patterns.md`](patterns.md) | building a list or table, row actions, a menu, chips, a dialog, a destructive action, or a loading / empty / error state |
| [`voice.md`](voice.md) | writing any visible or accessible text: labels, toasts, empty and error copy |
| [`review-checklist.md`](review-checklist.md) | finishing a change, before you open the PR |
| [`references.md`](references.md) | you need the published guidance behind a rule |

## The idea

The site is **a record library you work in under time pressure**. Every working screen is a dense, scannable list of music objects: rows that lead with artwork, read in a fixed order, and stay quiet until touched. **Hue carries meaning; variant carries intensity.** The *kind* of a thing (genre, format, bin, entry type) gets one assigned color, and how loud that color is says how live or operational the thing is. The physical station shows through on purpose: a call number is drawn as a filing-card badge, a rotating record shows its bin and card instead of a shelf address, and the copy sounds like a record shop.

**Test for any new element:** does it correspond to a real object or act in the library — a record, a call number, a bin, a card, a playlist entry, pulling a record, filing, retiring? If it does, give it that object's shape and vocabulary. If it doesn't, make it quiet and conventional. The metaphor lives in structure, location, and words, never in decorative texture.

## Principles

1. **Scan first.** True columns in a fixed, importance-ordered reading order. Hierarchy comes from weight and text tone, not color. A row must still read correctly with every chip removed.
2. **Quiet until touched, never invisible.** Secondary actions reveal on hover or keyboard focus. The row itself always signals it is interactive (hover fill, cursor, focus rail). On touch devices actions are always shown. Toggles that are *on* stay visible.
3. **Variant is a loudness ladder.** `plain` (history, ordinary) → `outlined` (shells, links, inactive controls) → `soft` (descriptive, categorized, pending) → `solid` (live, operational, the one primary action). Joy itself only ranks `solid` on top; the full order is a house rule.
4. **Physical objects, not data.** Location beats code: a record that isn't on the stacks shows where it actually is.
5. **One action model, many entry points.** Hover buttons, the right-click menu, the keyboard, and modifier gestures reach the same list of actions. Every pointer path has a keyboard path, and every accelerator has a plain one.
6. **Never alarm, never wait on words.** Feedback is visual: skeletons and spinners, never visible status text such as "Searching…". Screen readers still get the words, through a status region. Destructive actions are restrained, error copy reassures and offers a remedy, and an empty state is never confused with an outage.
7. **Server text is sacred.** Color and label tables are presentation, not vocabulary. An unknown genre or format falls back to neutral and its text renders exactly as sent.
8. **Collapse, don't redesign.** One table folds as space shrinks; only phones get cards, and those cards keep fixed field positions.

## Where the system lives in code

| Concern | Source of truth |
|---|---|
| Theme palettes (four themes × light/dark) | `lib/features/experiences/modern/themes/definitions.ts` |
| Fonts, weights, type scale overrides | `lib/features/experiences/modern/themes/buildTheme.ts` |
| Role → color/variant tables, bin colors, caption chips | `lib/features/experiences/modern/tokens/roles.ts` |
| Record table styles, row heights, ghost actions, tabular numerals | `src/utilities/modern/recordTableSx.ts` |
| Screen-reader status for loading states | `src/components/experiences/modern/StatusRegion.tsx` |
| Focus handling for menus built on Joy `MenuList` | `src/hooks/useMenuFocus.ts` |
| Confirmation and panel dialogs | `src/components/experiences/modern/ConfirmDialog.tsx` |
| Cover art with the informative placeholder | `RecordArtwork` / `AlbumArtwork` in `src/components/experiences/modern/catalog/AlbumArtwork.tsx` |
| Rotation location (bin + card) | `RotationLocationPill` in `src/components/experiences/modern/catalog/Results/`, `RotationCardBadge` in `src/components/shared/` |
| Reference implementation of a full surface | `src/components/experiences/modern/admin/rotation/shelf/` |

The Rotation Shelf is the most complete application of these rules; when in doubt, read it. The catalog and mail bin predate `recordTableSx` and still carry their own hover-reveal code: new work uses the shared contract, and touching those surfaces is a chance to move them onto it.
