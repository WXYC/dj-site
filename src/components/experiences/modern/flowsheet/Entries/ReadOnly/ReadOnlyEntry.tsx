"use client";

import {
  FlowsheetEntry,
  FlowsheetSongEntry,
  isFlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import {
  EntryFieldName,
  entryFieldTextColor,
} from "@/src/utilities/modern/entryFieldColors";
import { Box, Link, Stack, Typography } from "@mui/joy";
import NextLink from "next/link";
import { MouseEvent, memo, useRef } from "react";
import AlbumInfoButton from "../AlbumInfoButton";
import EntryTimeCell from "../Components/EntryTimeCell";
import { MarkerEntryArtwork, SongEntryArtwork } from "../EntryArtwork";
import EntryFieldText from "../EntryFieldText";
import { StaticEntryRow, useEntryRowAttributes } from "../EntryRow";
import { getMessageEntrySlots } from "../messageEntrySlots";
import SongEntryStatusChips from "../SongEntry/SongEntryStatusChips";
import { flowsheetChipsReservePx } from "../tableStyles";

/** The overlay link's stacking level in a linked row; the artwork and chips cells stay below it. */
export const SHOW_LINK_Z_INDEX = 1;
/** Controls above the overlay link: field tooltips, the Not-on-Discogs badge and the album control. */
export const RAISED_Z_INDEX = 2;

// Both the col-artist/col-label cells and their below-xl stacked second lines
// render at every width; FLOWSHEET_TABLE_SX's CSS breakpoints, not a
// media-query hook, decide which copy paints.
const ReadOnlySongEntry = memo(function ReadOnlySongEntry({
  playing,
  entry,
  timeLabel,
  showHref,
  highlighted = false,
  albumInfo = false,
}: {
  playing: boolean;
  entry: FlowsheetSongEntry;
  timeLabel?: string;
  showHref?: string | null;
  /** The row an archive link named; see EntryRow's `EntryRowAttributesInput`. */
  highlighted?: boolean;
  /**
   * Renders the album-information control in a song row's last cell; marker
   * rows ignore it. The control opens a signed-in dashboard page, so leave it
   * off on a public route.
   */
  albumInfo?: boolean;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const linkHref = typeof showHref === "string" ? showHref : null;
  const linked = linkHref !== null;
  const raisesArtwork = linked && entry.discogsUnavailable === true;
  const showName = `${entry.track_title} by ${entry.artist_name}`;

  // A plain primary click on a raised field stands in for a click on the link.
  // Modified clicks and clicks that end a text selection stay with the field.
  const forwardClick = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if ((window.getSelection()?.toString() ?? "") !== "") return;
    linkRef.current?.click();
  };

  const field = (
    label: EntryFieldName,
    name: keyof FlowsheetSongEntry,
    level: "title-sm" | "body-sm" | "body-xs"
  ) => (
    <EntryFieldText
      value={String(entry[name])}
      label={label}
      level={level}
      textColor={entryFieldTextColor(label, playing)}
      cursor={linked ? "pointer" : undefined}
      onClick={linked ? forwardClick : undefined}
      sx={linked ? { position: "relative", zIndex: RAISED_Z_INDEX, width: "fit-content", maxWidth: "100%" } : undefined}
    />
  );

  // A marked row must not also resolve to `plain`: that variant's hover
  // fill is painted straight onto the cells and would wipe the mark out from
  // under the pointer, mirroring SongEntry's same guard.
  const attributes = useEntryRowAttributes({
    entry,
    variant: highlighted ? "soft" : playing ? "solid" : "plain",
    color: highlighted ? "danger" : playing ? "primary" : "neutral",
    style: { height: "60px", borderRadius: "md", ...(linked ? { position: "relative", isolation: "isolate" } : {}) },
    highlighted,
  });

  return (
    <StaticEntryRow {...attributes}>
      {timeLabel !== undefined &&
        (linkHref !== null ? (
          <td className="col-time">
            <Link
              ref={linkRef}
              component={NextLink}
              href={linkHref}
              prefetch={false}
              overlay
              underline="none"
              level="body-xs"
              textColor="text.tertiary"
              aria-label={timeLabel ? `${timeLabel} — see the full show for ${showName}` : `See the full show for ${showName}`}
              sx={{ "&::after": { zIndex: SHOW_LINK_Z_INDEX } }}
            >
              {timeLabel}
            </Link>
          </td>
        ) : (
          <EntryTimeCell label={timeLabel} />
        ))}
      <td style={{ position: "relative", zIndex: raisesArtwork ? RAISED_Z_INDEX : undefined }}>
        <SongEntryArtwork entry={entry} />
      </td>
      <td className="col-artist">
        {field("artist", "artist_name", "body-sm")}
      </td>
      <td>
        {field("song", "track_title", "title-sm")}
        <Box className="field-second-line">
          {field("artist", "artist_name", "body-xs")}
        </Box>
      </td>
      <td>
        {field("album", "album_title", "body-sm")}
        <Box className="field-second-line">
          {field("label", "record_label", "body-xs")}
        </Box>
      </td>
      <td className="col-label">{field("label", "record_label", "body-sm")}</td>
      <td style={{ position: "relative" }}>
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          flexWrap="wrap"
          sx={albumInfo ? { pr: `${flowsheetChipsReservePx(false)}px` } : undefined}
        >
          <SongEntryStatusChips entry={entry} editable={false} />
        </Stack>
        {albumInfo && (
          <Box sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: linked ? RAISED_Z_INDEX : undefined }}>
            <AlbumInfoButton entry={entry} />
          </Box>
        )}
      </td>
    </StaticEntryRow>
  );
});

// CSS can't switch a colSpan, so the middle cell renders twice — xl-only
// colSpan-4 and below-xl colSpan-2 — one hidden at each width. The hidden
// copy drops out of the accessibility tree via `display: none`.
function ReadOnlyMessageEntry({
  entry,
  timeLabel,
  highlighted = false,
}: {
  entry: FlowsheetEntry;
  timeLabel?: string;
  /** The row an archive link named; see EntryRow's `EntryRowAttributesInput`. */
  highlighted?: boolean;
}) {
  const slots = getMessageEntrySlots(entry);
  const cellStyle = { height: "30px", borderRadius: "md" };

  // Mirrors MessageEntry's same highlighted-overrides-color guard: a marked
  // row reads as danger regardless of the marker's own tone.
  const attributes = useEntryRowAttributes({
    entry,
    variant: "soft",
    color: highlighted ? "danger" : slots.color,
    className: "row-marker",
    style: { height: "40px", borderRadius: "md" },
    highlighted,
  });

  return (
    <StaticEntryRow {...attributes}>
      {timeLabel !== undefined && <EntryTimeCell label={timeLabel} />}
      <td style={{ position: "relative" }}>
        <MarkerEntryArtwork icon={slots.startDecorator} />
      </td>
      <Box
        component="td"
        className="col-marker-xl"
        style={cellStyle}
        colSpan={4}
      >
        {slots.messageBlock}
      </Box>
      <Box
        component="td"
        className="col-marker-compact"
        style={cellStyle}
        colSpan={2}
      >
        {slots.messageBlock}
      </Box>
      <td>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="end"
        >
          <Typography level="body-xs">{slots.endDecorator}</Typography>
        </Stack>
      </td>
    </StaticEntryRow>
  );
}

/**
 * `showHref` links a song row's Time cell, so it requires `timeLabel`. Marker
 * rows ignore it. A linked row is not supported while playing: the `row-playing`
 * cells' `clip-path` would confine the overlay to the Time cell.
 */
type ShowLinkProps =
  | { timeLabel?: string; showHref?: null }
  | { timeLabel: string; showHref?: string | null };

/**
 * A read-only flowsheet row (song, talkset, breakpoint, or show marker) whose
 * module graph reaches no live-show hook, bin API, or LML API — see
 * tests/contract/entries-motion-free.test.ts for the enforced list — so it is
 * safe to mount on a public, unauthenticated route.
 *
 * It renders no action cluster. The live row's segue/request toggles and
 * remove button live in SongEntryControls, which imports the live-show hooks
 * this row must not reach, so they are left out; the "Album information"
 * button is the one live control this row can opt into (`albumInfo`), since
 * AlbumInfoButton itself reaches none of those hooks.
 * Smaller differences from the live row under `readOnly`: field text carries
 * no `cursor: default`, and two wrappers are absent: the flex Box around
 * each field, which hosts the live row's edit pencil, and the
 * `position: relative` Stack around the song artwork, which anchors the
 * queue's Play-now overlay.
 *
 * Renders correctly only inside a table whose `sx` spreads
 * `FLOWSHEET_TABLE_SX`: the artist and label fields paint both their xl and
 * below-xl copy unconditionally (title and album paint once), and that
 * table's CSS breakpoints — not a media-query hook — are what hide the wrong
 * one. Under any other `sx`, both copies show at once, and a marker row's xl
 * and compact cells both render, bringing its column total to 8 against an
 * intended 6.
 */
const ReadOnlyEntry = memo(function ReadOnlyEntry({
  entry,
  playing,
  timeLabel,
  showHref,
  highlighted = false,
  albumInfo = false,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
  /** The row an archive link named; see EntryRow's `EntryRowAttributesInput`. */
  highlighted?: boolean;
  /**
   * Renders the album-information control in a song row's last cell; marker
   * rows ignore it. The control opens a signed-in dashboard page, so leave it
   * off on a public route.
   */
  albumInfo?: boolean;
} & ShowLinkProps) {
  if (isFlowsheetSongEntry(entry)) {
    return (
      <ReadOnlySongEntry
        playing={playing}
        entry={entry}
        timeLabel={timeLabel}
        showHref={showHref}
        highlighted={highlighted}
        albumInfo={albumInfo}
      />
    );
  }

  return (
    <ReadOnlyMessageEntry
      entry={entry}
      timeLabel={timeLabel}
      highlighted={highlighted}
    />
  );
});

export default ReadOnlyEntry;
