import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import SongEntry from "./SongEntry/SongEntry";

export default function Entry({
  entry,
  playing,
}: {
  entry: FlowsheetEntry;
  playing: boolean;
}) {
  if (isFlowsheetSongEntry(entry)) {
    return <SongEntry playing={entry.request_flag} entry={entry} queue={false} />;
  }

  return <div>{entry.id}</div>;
}
