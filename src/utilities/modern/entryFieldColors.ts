export type EntryFieldName = "song" | "artist" | "album" | "label";

// The song title anchors the row in the primary text color; the remaining
// fields (artist, album, label) read as a dimmed form of it — one clean
// hierarchy rather than a per-field color rainbow.
export function entryFieldTextColor(
  field: EntryFieldName,
  playing: boolean
): string {
  const isTitle = field === "song";
  if (playing) {
    return isTitle ? "common.white" : "rgba(255, 255, 255, 0.72)";
  }
  return isTitle ? "text.primary" : "text.secondary";
}
