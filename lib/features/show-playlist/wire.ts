import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import type { ShowPlaylistEntryWire } from "./types";

/**
 * Adapts one published V2 entry to the flat shape `convertRangeEntry` reads.
 *
 * Both ends of this boundary are declared in `api.yaml`, so the conversion is
 * exactly the places the two declarations disagree, and nothing else. They
 * disagree twice, in one direction each.
 *
 * The V2 track variant types six fields nullable where `FlowsheetEntryFields`
 * types them plain — `album_id`, `rotation_id`, `artist_name`, `album_title`,
 * `track_title`, `record_label` — as does the V2 breakpoint variant's
 * `message`. Each null becomes an absent key rather than being coerced or cast
 * away: absence is the only one of the two the flat shape can hold, and every
 * reader downstream already treats the two alike. And `request_flag` is
 * required on the flat shape while only the track variant emits it; false is
 * the safe default, because it is a playcut property and every variant that
 * omits it renders as a marker.
 *
 * Deliberately no cast. The narrowing runs on the union's own discriminator —
 * the same `switch (entry.entry_type)` `convertV2Entry` and `convertRangeEntry`
 * use next door — so the next field the two schemas disagree about arrives here
 * as a compile error rather than being absorbed silently. That is the whole
 * reason this is a function and not a spread at the call site.
 */
export function v2ToRangeShape(
  entry: ShowPlaylistEntryWire
): FlowsheetRangeEntryWire {
  switch (entry.entry_type) {
    case "track": {
      const {
        album_id,
        rotation_id,
        artist_name,
        album_title,
        track_title,
        record_label,
        ...rest
      } = entry;

      return {
        ...rest,
        ...(album_id != null ? { album_id } : {}),
        ...(rotation_id != null ? { rotation_id } : {}),
        ...(artist_name != null ? { artist_name } : {}),
        ...(album_title != null ? { album_title } : {}),
        ...(track_title != null ? { track_title } : {}),
        ...(record_label != null ? { record_label } : {}),
      };
    }

    case "breakpoint": {
      const { message, ...rest } = entry;

      return {
        ...rest,
        ...(message != null ? { message } : {}),
        request_flag: false,
      };
    }

    // Every remaining variant is a marker, and none of them declares a field
    // the flat shape types more narrowly. No default arm: the vocabulary is
    // server-owned, and a variant added upstream should land here as a missing
    // case rather than as a row that quietly converts wrong.
    case "show_start":
    case "show_end":
    case "dj_join":
    case "dj_leave":
    case "talkset":
    case "message":
      return { ...entry, request_flag: false };
  }
}
