"use client";

import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { Box, Sheet, Typography } from "@mui/joy";
import { memo } from "react";
import DateTimeStack from "./Components/DateTimeStack";
import RemoveButton from "./Components/RemoveButton";
import { getMessageEntryPresentation } from "./entryPresentation";
import MobileSongEntry from "./SongEntry/MobileSongEntry";

// Mobile counterpart of Entry.tsx: dispatches an entry to its stacked-card
// renderer below the `sm` breakpoint. Memoized (see Entry — Immer gives
// changed entries new references).
const MobileEntry = memo(function MobileEntry({
  entry,
  playing,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
}) {
  const { live, currentShow } = useShowControl();

  if (isFlowsheetSongEntry(entry)) {
    return <MobileSongEntry entry={entry} playing={playing} queue={false} />;
  }

  const editable = entry.show_id == currentShow;
  const p = getMessageEntryPresentation(entry);
  const removable = live && editable && p.editable;

  return (
    <Sheet
      variant="soft"
      color={p.color}
      sx={{
        borderRadius: "xl",
        px: 1.75,
        py: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1,
        boxShadow: "0 4px 12px -4px rgba(0,0,0,0.3)",
      }}
    >
      <Box
        sx={{ display: "flex", color: `${p.color}.plainColor`, flexShrink: 0 }}
      >
        <p.Icon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography level="body-sm" color={p.textColor}>
          {p.headline}
        </Typography>
        {p.caption && (
          <>
            {" "}
            <Typography level="body-sm" textColor="text.tertiary">
              {p.caption}
            </Typography>
          </>
        )}
      </Box>
      {p.time && (
        <Typography
          level="body-xs"
          textColor="text.tertiary"
          sx={{ flexShrink: 0 }}
        >
          <DateTimeStack day={p.time.day} time={p.time.time} />
        </Typography>
      )}
      {removable && <RemoveButton queue={false} entry={entry} />}
    </Sheet>
  );
});

export default MobileEntry;
