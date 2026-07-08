import { findTriggerOffsets } from "./parser/parseSmartEntry";
import type { SmartField } from "./parser/types";

export type FilledSentence = {
  raw: string;
  locks: Partial<Record<SmartField, string>>;
  /** Offsets of trigger words inside filled values, to suppress. */
  suppress: number[];
};

const CONNECTOR: Record<"artist" | "album" | "label", string> = {
  artist: "by",
  album: "on",
  label: "via",
};

/**
 * Build a filled composer sentence from the user's song plus a selected
 * result's artist/album/label — "Song by Artist on Album via Label". The song
 * stays leading and user-authored; the other fields are appended with their
 * connectors and returned as locks (search constraints). Trigger words inside
 * any value (including the song, e.g. "Stand by Me") are collected in
 * `suppress` so they stay literal and don't split the sentence.
 */
export function buildFilledSentence(
  song: string,
  fields: { artist?: string; album?: string; label?: string }
): FilledSentence {
  let raw = "";
  const ranges: Array<[number, number]> = [];
  const locks: Partial<Record<SmartField, string>> = {};

  const add = (field: SmartField, value: string, connector: string | null) => {
    const v = value.trim();
    if (!v) return;
    if (raw) raw += " ";
    if (connector) raw += connector + " ";
    const start = raw.length;
    raw += v;
    ranges.push([start, raw.length]);
    if (field !== "song") locks[field] = v;
  };

  add("song", song, null);
  add("artist", fields.artist ?? "", CONNECTOR.artist);
  add("album", fields.album ?? "", CONNECTOR.album);
  add("label", fields.label ?? "", CONNECTOR.label);

  const suppress = findTriggerOffsets(raw).filter((offset) =>
    ranges.some(([start, end]) => offset >= start && offset < end)
  );

  return { raw, locks, suppress };
}
