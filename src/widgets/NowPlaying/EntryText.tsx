import {
  FlowsheetEntry,
  FlowsheetMessageEntry,
  isFlowsheetBreakpointEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
  isFlowsheetTalksetEntry,
} from "@/lib/features/flowsheet/types";
import { Stack, Typography } from "@mui/joy";

export default function EntryText({
  entry,
}: {
  entry: FlowsheetEntry | undefined;
}) {
  if (!entry) {
    return (
      <EntryStack>
        <Typography level="body-sm">You're Listening To</Typography>
        <Typography level="title-md">WXYC Chapel Hill</Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    return (
      <EntryStack>
        <Typography level="title-md">{entry.album_title}</Typography>
        <Typography level="body-sm">{entry.artist_name}</Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <EntryStack>
        <Typography color="warning" level="title-md">
          {entry.message}
        </Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <EntryStack>
        <Stack direction="row" spacing={0.5}>
          <Typography level="title-md" color={"success"}>
            {entry.dj_name}
          </Typography>
          <Typography
            level="title-md"
            textColor={"text.tertiary"}
            sx={{ alignSelf: "center" }}
          >
            started the set
          </Typography>
        </Stack>
      </EntryStack>
    );
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return (
      <EntryStack>
        <Stack direction="row" spacing={0.5}>
          <Typography level="title-md" color={"primary"}>
            {entry.dj_name}
          </Typography>
          <Typography
            level="title-md"
            textColor={"text.tertiary"}
            sx={{ alignSelf: "center" }}
          >
            ended the set
          </Typography>
        </Stack>
      </EntryStack>
    );
  }

  if (isFlowsheetTalksetEntry(entry)) {
    return (
      <EntryStack>
        <Typography level="title-md" color={"danger"}>
          Talkset
        </Typography>
      </EntryStack>
    );
  }

  return (
    <EntryStack>
      <Typography level="title-md">
        {(entry as FlowsheetMessageEntry).message}
      </Typography>
    </EntryStack>
  );
}

const EntryStack = ({ children }: { children?: React.ReactNode }) => {
  return (
    <Stack
      sx={{
        minHeight: "60px",
        justifyContent: "center",
      }}
    >
      {children}
    </Stack>
  );
};
