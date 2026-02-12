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
        <Typography level="body-sm">You&apos;re Listening To</Typography>
        <Typography level="title-md">WXYC Chapel Hill</Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetSongEntry(entry)) {
    return (
      <EntryStack>
        <Typography level="title-md" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.album_title}
        </Typography>
        <Typography level="body-sm" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.artist_name}
        </Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetBreakpointEntry(entry)) {
    return (
      <EntryStack>
        <Typography color="warning" level="title-md" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.message}
        </Typography>
      </EntryStack>
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return (
      <EntryStack>
        <Stack direction="row" spacing={0.5} sx={{ minWidth: 0, overflow: "hidden" }}>
          <Typography level="title-md" color={"success"} sx={{ flexShrink: 0 }}>
            {entry.dj_name}
          </Typography>
          <Typography
            level="title-md"
            textColor={"text.tertiary"}
            sx={{ alignSelf: "center", flexShrink: 0 }}
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
        <Stack direction="row" spacing={0.5} sx={{ minWidth: 0, overflow: "hidden" }}>
          <Typography level="title-md" color={"primary"} sx={{ flexShrink: 0 }}>
            {entry.dj_name}
          </Typography>
          <Typography
            level="title-md"
            textColor={"text.tertiary"}
            sx={{ alignSelf: "center", flexShrink: 0 }}
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
      <Typography level="title-md" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
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
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      {children}
    </Stack>
  );
};
