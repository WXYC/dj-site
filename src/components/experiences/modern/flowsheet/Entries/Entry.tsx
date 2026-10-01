import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { memo } from "react";
import { getMessageEntrySlots } from "./messageEntrySlots";
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
  highlighted = false,
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
  /**
   * The row an archive link named: it alone carries the anchor the link's
   * fragment points at.
   */
  highlighted?: boolean;
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
        highlighted={highlighted}
      />
    );
  }

  const slots = getMessageEntrySlots(entry);

  return (
    <MessageEntry
      entry={entry}
      startDecorator={slots.startDecorator}
      endDecorator={slots.endDecorator}
      color={slots.color}
      variant="soft"
      disableEditing={!slots.editable}
      readOnly={readOnly}
      timeLabel={timeLabel}
      draggable={resolvedDraggable}
      highlighted={highlighted}
    >
      {slots.messageBlock}
    </MessageEntry>
  );
});

export default Entry;
