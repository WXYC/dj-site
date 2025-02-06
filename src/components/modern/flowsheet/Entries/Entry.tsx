import {
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
        startDecorator={<Headphones sx={{ mb: -0.5, mr: 0.5 }} />}
        endDecorator={
          <Typography level="body-xs">{entry.date_string}</Typography>
        }
        color={"success"}
        variant={"soft"}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">{entry.dj_name}</Typography>
          <Typography textColor={"text.tertiary"} sx={{ alignSelf: "center" }}>started the set</Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <MessageEntry
        startDecorator={<Logout sx={{ mb: -0.5, mr: 0.5 }} />}
        endDecorator={
          <Typography level="body-xs">{entry.date_string}</Typography>
        }
        color={"neutral"}
        variant={"soft"}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">Set Ended</Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <MessageEntry
        startDecorator={<Mic sx={{ mb: -0.5, mr: 0.5 }} />}
        color={"success"}
        variant={"solid"}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">
            {(entry as FlowsheetMessageEntry).message}
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <MessageEntry
        startDecorator={<Timer sx={{ mb: -0.5, mr: 0.5 }} />}
        color={"warning"}
        variant={"solid"}
      >
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">
            {(entry as FlowsheetMessageEntry).message}
          </Typography>
        </Stack>
      </MessageEntry>
    );
  }

  return (
    <MessageEntry
      color={"primary"}
      variant={"soft"}
      startDecorator={<Notifications sx={{ mb: -0.5, mr: 0.5 }} />}
    >
      <Typography level="body-lg">
        {(entry as FlowsheetMessageEntry).message}
      </Typography>
    </MessageEntry>
  );
}
