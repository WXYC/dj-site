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
 * use next door — which is the whole reason this is a function and not a spread
 * at the call site.
 *
 * What that buys is narrower than "the schemas can no longer drift unnoticed",
 * and the difference matters because an over-promising comment here is what let
 * the last defect through. A field both shapes declare, typed more loosely on
 * one, arrives as a compile error. A field only the V2 shape declares does not:
 * it rides `...rest` into the flat shape, and TypeScript applies no excess-
 * property check to spread-in properties. Several already do exactly that.
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
    // the flat shape types more narrowly.
    case "show_start":
    case "show_end":
    case "dj_join":
    case "dj_leave":
    case "talkset":
    case "message":
      return { ...entry, request_flag: false };

    // The entry-type vocabulary is server-owned and grows additively, so the
    // two obligations here pull in opposite directions and both have to be met.
    // A variant added upstream must reach a developer as a compile error, which
    // is what the `never` assignment below is for — it stops compiling the
    // moment the union gains a member. But it must also still render on builds
    // that shipped before the addition: this function is mapped over every
    // entry in a show, and an arm that fell through would return undefined into
    // an array typed as holding none, which the callers dereference — costing
    // the whole table rather than the one row. Unknown variants therefore
    // convert as markers, the same as the six above, matching the policy
    // `convertRangeEntry` states for the same vocabulary.
    default: {
      const unhandled: never = entry;
      // Which fields an unknown variant declares is by definition unknown, so
      // the null-to-absent rule the arms above apply field by field is applied
      // here by shape instead. It is the same rule, and the only form of it
      // available without the declaration.
      const withoutNulls = Object.fromEntries(
        Object.entries(unhandled as ShowPlaylistEntryWire).filter(
          ([, value]) => value !== null
        )
      ) as FlowsheetRangeEntryWire;

      return { ...withoutNulls, request_flag: false };
    }
  }
}
