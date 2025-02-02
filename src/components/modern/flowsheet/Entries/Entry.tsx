import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetSongEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import JoinedEntry from "./JoinedEntry";
import SongEntry from "./SongEntry/SongEntry";
import LeftEntry from "./LeftEntry";

export default function Entry({
  entry,
  playing,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
}) {
  if (isFlowsheetSongEntry(entry)) {
    return (
      <SongEntry playing={entry.request_flag} entry={entry} queue={false} />
    );
  }

  if (isFlowsheetStartShowEntry(entry)) {
    return <JoinedEntry entry={entry} />;
  }

  if (isFlowsheetEndShowEntry(entry)) {
    return <LeftEntry entry={entry} />;
  }

  return <div>{entry.id}</div>;
}
