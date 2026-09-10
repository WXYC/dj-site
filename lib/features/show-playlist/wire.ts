import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import type { ShowPlaylistEntryWire } from "./types";

/**
 * Adapts one V2 entry to the flat shape `convertArchiveEntry` reads.
 *
 * Not a spread at the call site: `FlowsheetEntryFields.request_flag` is
 * required and only the V2 track variant emits it, and the track variant
 * declares `album_id` / `rotation_id` nullable where the flat shape declares
 * them numbers — so a bare cast fails under strict mode on exactly the rows
 * markers produce. Defaulting `request_flag` here is safe: it is a playcut
 * property, and every entry type that omits it renders as a marker.
 *
 * The result is the widened wire type rather than the published one because
 * `on_streaming` rides the payload undeclared.
 */
export function v2ToRangeShape(
  entry: ShowPlaylistEntryWire
): FlowsheetRangeEntryWire {
  const { album_id, rotation_id, request_flag, ...rest } = entry;

  return {
    ...rest,
    ...(typeof album_id === "number" ? { album_id } : {}),
    ...(typeof rotation_id === "number" ? { rotation_id } : {}),
    request_flag: request_flag ?? false,
  } as unknown as FlowsheetRangeEntryWire;
}
