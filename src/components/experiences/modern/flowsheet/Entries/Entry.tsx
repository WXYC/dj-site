import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { Stack, Typography } from "@mui/joy";
import { memo } from "react";
import DateTimeStack from "./Components/DateTimeStack";
import { getMessageEntryPresentation } from "./entryPresentation";
import MessageEntry from "./MessageEntry";
import SongEntry from "./SongEntry/SongEntry";

// Memoized: entry updates flow through Immer (RTK Query cache patches +
// slice reducers), so a changed entry always arrives as a new object
// reference and unchanged rows can safely skip re-rendering.
const Entry = memo(function Entry({
  entry,
  playing,
  draggable = false,
  readOnly = false,
  timeLabel,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
  draggable?: boolean;
  /**
   * Suppresses every editing affordance on the row, whatever the live-show
   * state says. An archive surface passes this rather than leaning on the
   * live row's own `editable` resolving false, which would make a view of a
   * years-old set depend on who happens to be on the air right now.
   */
  readOnly?: boolean;
  /**
   * Renders the row's leading Time cell — the 7th column unit. Pass it only
   * alongside `FlowsheetColumnSizingRow`'s `leadingTimeColumn`, or fixed-layout
   * sizing degrades.
   */
  timeLabel?: string;
}) {
  // Markers count in position math (the server renumbers every entry type)
  // but are never themselves draggable.
  const isMarker =
    isFlowsheetStartShowEntry(entry) || isFlowsheetEndShowEntry(entry);
  const resolvedDraggable = draggable && !isMarker && !readOnly;

  if (isFlowsheetSongEntry(entry)) {
    return (
      <SongEntry
        playing={playing}
        entry={entry}
        queue={false}
        draggable={resolvedDraggable}
        readOnly={readOnly}
        timeLabel={timeLabel}
      />
    );
  }

  const p = getMessageEntryPresentation(entry);

  return (
    <MessageEntry
      entry={entry}
      startDecorator={<p.Icon sx={{ mb: -0.5, mr: 0.5 }} />}
      endDecorator={
        p.time && (
          <DateTimeStack
            day={p.time.day}
            time={p.time.time}
            isToday={p.time.isToday}
          />
        )
      }
      color={p.color}
      variant="soft"
      disableEditing={!p.editable}
      readOnly={readOnly}
      timeLabel={timeLabel}
      draggable={resolvedDraggable}
    >
      <Stack direction="row" spacing={0.5}>
        <Typography level="body-lg" color={p.textColor}>
          {p.headline}
        </Typography>
        {p.caption && (
          <Typography textColor={"text.tertiary"} sx={{ alignSelf: "center" }}>
            {p.caption}
          </Typography>
        )}
      </Stack>
    </MessageEntry>
  );
});

export default Entry;
