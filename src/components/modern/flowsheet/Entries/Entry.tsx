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
import {
  Headphones,
  Logout,
  Mic,
  Notifications,
  Timer,
} from "@mui/icons-material";
import { Stack, Typography } from "@mui/joy";
import DateTimeStack from "./Components/DateTimeStack";
import MessageEntry from "./MessageEntry";
import SongEntry from "./SongEntry/SongEntry";

export default function Entry({
  entry,
  playing,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
}) {
  if (isFlowsheetSongEntry(entry)) {
    return <SongEntry playing={playing} entry={entry} queue={false} />;
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <MessageEntry
        entryRef={entry}
        startDecorator={<Headphones sx={{ mb: -0.5, mr: 0.5 }} />}
        endDecorator={<DateTimeStack day={entry.day} time={entry.time} />}
        color={"success"}
        variant="plain"
        disableEditing={true}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg" color={"success"}>
            {entry.dj_name}
          </Typography>
          <Typography textColor={"text.tertiary"} sx={{ alignSelf: "center" }}>
            started the set
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <MessageEntry
        entryRef={entry}
        startDecorator={<Logout sx={{ mb: -0.5, mr: 0.5 }} />}
        endDecorator={<DateTimeStack day={entry.day} time={entry.time} />}
        color={"neutral"}
        variant="plain"
        disableEditing={true}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg" color={"primary"}>
            {entry.dj_name}
          </Typography>
          <Typography textColor={"text.tertiary"} sx={{ alignSelf: "center" }}>
            ended the set
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <MessageEntry
        entryRef={entry}
        startDecorator={<Mic sx={{ mb: -0.5, mr: 0.5 }} />}
        color={"danger"}
        variant="plain"
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg" color={"danger"}>
            {(entry as FlowsheetMessageEntry).message}
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <MessageEntry
        entryRef={entry}
        startDecorator={<Timer sx={{ mb: -0.5, mr: 0.5 }} />}
        color={"warning"}
        variant="plain"
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg" color="warning">
            {(entry as FlowsheetBreakpointEntry).message}
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  return (
    <MessageEntry
      entryRef={entry}
      color={"warning"}
      variant="plain"
      startDecorator={<Notifications sx={{ mb: -0.5, mr: 0.5 }} />}
    >
      <Typography level="body-lg" color={"warning"}>
        {(entry as FlowsheetMessageEntry).message}
      </Typography>
    </MessageEntry>
  );
}
