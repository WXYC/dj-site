"use client";

import {
  FlowsheetBreakpointEntry,
  FlowsheetEntry,
  FlowsheetMessageEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import {
  Headphones,
  Logout,
  Mic,
  Notifications,
  Timer,
} from "@mui/icons-material";
import { Box, ColorPaletteProp, Sheet, Stack, Typography } from "@mui/joy";
import DateTimeStack from "./Components/DateTimeStack";
import RemoveButton from "./Components/RemoveButton";
import MobileSongEntry from "./SongEntry/MobileSongEntry";

// Mobile counterpart of Entry.tsx: dispatches an entry to its stacked-card
// renderer below the `sm` breakpoint.
export default function MobileEntry({
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
  const removable =
    live &&
    editable &&
    !isFlowsheetStartShowEntry(entry) &&
    !isFlowsheetEndShowEntry(entry);

  let icon = <Notifications />;
  let color: ColorPaletteProp = "warning";
  let content: React.ReactNode = (entry as FlowsheetMessageEntry).message;
  let time: React.ReactNode = null;

  if (isFlowsheetStartShowEntry(entry)) {
    icon = <Headphones />;
    color = "success";
    time = <DateTimeStack day={entry.day} time={entry.time} />;
    content = (
      <>
        <Typography level="body-sm" color="success">
          {entry.dj_name}
        </Typography>{" "}
        <Typography level="body-sm" textColor="text.tertiary">
          started the set
        </Typography>
      </>
    );
  } else if (isFlowsheetEndShowEntry(entry)) {
    icon = <Logout />;
    color = "success";
    time = <DateTimeStack day={entry.day} time={entry.time} />;
    content = (
      <>
        <Typography level="body-sm" color="primary">
          {entry.dj_name}
        </Typography>{" "}
        <Typography level="body-sm" textColor="text.tertiary">
          ended the set
        </Typography>
      </>
    );
  } else if (isFlowsheetTalksetEntry(entry)) {
    icon = <Mic />;
    color = "danger";
    content = (
      <Typography level="body-sm" color="danger">
        {(entry as FlowsheetMessageEntry).message}
      </Typography>
    );
  } else if (isFlowsheetBreakpointEntry(entry)) {
    icon = <Timer />;
    color = "warning";
    content = (
      <Typography level="body-sm" color="warning">
        {(entry as FlowsheetBreakpointEntry).message}
      </Typography>
    );
  }

  return (
    <Sheet
      variant="soft"
      color={color}
      sx={{
        borderRadius: "md",
        px: 1.5,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", color: `${color}.plainColor`, flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{content}</Box>
      {time && (
        <Typography level="body-xs" textColor="text.tertiary" sx={{ flexShrink: 0 }}>
          {time}
        </Typography>
      )}
      {removable && <RemoveButton queue={false} entry={entry} />}
    </Sheet>
  );
}
