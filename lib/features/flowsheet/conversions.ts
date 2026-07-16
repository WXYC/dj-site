import { Rotation } from "../rotation/types";
import { OFF_AIR_LABEL } from "./constants";
import { hasLinkedAlbumId } from "./linkage";
import {
  FlowsheetEntry,
  FlowsheetQuery,
  FlowsheetSubmissionParams,
  FlowsheetV2EntryJSON,
  FlowsheetV2PaginatedResponseJSON,
  OnAirDJData,
  OnAirDJResponse,
} from "./types";

export function formatOnAirSummary(djs: OnAirDJResponse[]): string {
  if (!djs.length) return OFF_AIR_LABEL;
  return djs.map((dj) => dj.dj_name).join(", ");
}

export function convertQueryToSubmission(
  query: FlowsheetQuery
): FlowsheetSubmissionParams {
  // BS's `FlowsheetCreateSongFromCatalog` variant requires a positive
  // `album_id` (a real `library.id`); the rotation-linkage fields
  // (`rotation_id`, `rotation_bin`) and the Discogs tracklist position
  // (`track_position`) only land on the wire when paired with it.
  // `track_position` is a `release_track.position` reference into a specific
  // Discogs release — orphaning it on the freeform variant produces a
  // position string ("A1") with no album to position into, so reducers that
  // overwrite `album_id` but leave a stale `track_position` (e.g.
  // `setRotationMetadata`) must not leak it to the wire.
  // The Modern rotation picker and the bin → queue path can both write a
  // synthesized negative `album_id` for library-unlinked rotation rows
  // (`synthesizeAlbumId` in `lib/features/catalog/conversions.ts`); on
  // negative numbers BS takes the `album_id != null` branch, calls
  // `getAlbumFromDB(-X)` → undefined → throws TypeError. Gate here so any
  // caller that lands a non-positive `album_id` falls back to the freeform
  // variant — at the cost of the rotation linkage, until BS-side schema work
  // lands. Matches the Classic-side shape from PR #699. (dj-site#701)
  const hasLinkedAlbum = hasLinkedAlbumId(query.album_id);
  return {
    track_title: query.song,
    artist_name: query.artist,
    album_title: query.album,
    record_label: query.label,
    request_flag: query.request,
    segue: query.segue,
    ...(hasLinkedAlbum && {
      album_id: query.album_id,
      rotation_id: query.rotation_id,
      rotation_bin: query.rotation_bin,
      ...(query.track_position !== undefined && {
        track_position: query.track_position,
      }),
    }),
  };
}

export function convertDJsOnAir(
  response: OnAirDJResponse[] | undefined
): OnAirDJData {
  if (!response || response.length === 0) {
    return {
      djs: [],
      onAir: OFF_AIR_LABEL,
    };
  }

  return {
    djs: response,
    onAir: formatOnAirSummary(response),
  };
}

// Whether an "M/D/YYYY" display day is today. The comparison is done here,
// against a today string built the same way, rather than by re-parsing the
// display string with `new Date(day)` downstream — non-ISO date parsing is
// implementation-defined and Safari returns `Invalid Date` for "M/D/YYYY",
// which made the old DateTimeStack is-today check false-negative and always
// render the date label. (dj-site#622)
//
// The exact-string match is deliberately fragile in the SAFE direction: if a
// backend timestamp is zero-padded or timezone-shifted the strings mismatch
// and the date is SHOWN (harmless clutter). Do not "fix" this into a parsed
// comparison — that reintroduces the implementation-defined parsing above.
function isTodayDisplayDay(day: string): boolean {
  const now = new Date();
  return day === `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
}

function parseTimestamp(timestamp: string): {
  day: string;
  time: string;
  isToday: boolean;
} {
  if (!timestamp) {
    return { day: "Unknown", time: "Unknown", isToday: false };
  }
  const commaIndex = timestamp.indexOf(",");
  if (commaIndex === -1) {
    return { day: "Unknown", time: "Unknown", isToday: false };
  }
  const day = timestamp.substring(0, commaIndex).trim();
  return {
    day,
    time: timestamp.substring(commaIndex + 1).trim(),
    isToday: isTodayDisplayDay(day),
  };
}

function formatAddTime(isoString: string): {
  day: string;
  time: string;
  isToday: boolean;
} {
  const date = new Date(isoString);
  const day = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return { day, time: `${h}:${m}:${s} ${ampm}`, isToday: isTodayDisplayDay(day) };
}

export function convertV2Entry(entry: FlowsheetV2EntryJSON): FlowsheetEntry {
  const base = {
    id: entry.id,
    play_order: entry.play_order,
    // -1 mirrors primaryShowId's no-show sentinel; 0 collides with a real
    // show id and would mis-partition orphaned entries into it (#629).
    show_id: entry.show_id ?? -1,
  };

  switch (entry.entry_type) {
    case "track":
      return {
        ...base,
        track_title: entry.track_title || "",
        artist_name: entry.artist_name || "",
        album_title: entry.album_title || "",
        record_label: entry.record_label || "",
        request_flag: entry.request_flag,
        segue: entry.segue ?? undefined,
        album_id: entry.album_id ?? undefined,
        rotation_id: entry.rotation_id ?? undefined,
        rotation: entry.rotation_bin as Rotation,
        on_streaming: entry.on_streaming ?? undefined,
        artwork_url: entry.artwork_url ?? undefined,
      };

    case "show_start": {
      const { day, time, isToday } =
        entry.timestamp !== undefined
          ? parseTimestamp(entry.timestamp)
          : formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name ?? (entry as any).artist_name ?? "",
        isStart: true,
        day,
        time,
        isToday,
      };
    }

    case "show_end": {
      const { day, time, isToday } =
        entry.timestamp !== undefined
          ? parseTimestamp(entry.timestamp)
          : formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name ?? (entry as any).artist_name ?? "",
        isStart: false,
        day,
        time,
        isToday,
      };
    }

    case "dj_join": {
      const { day, time, isToday } = formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: true,
        day,
        time,
        isToday,
      };
    }

    case "dj_leave": {
      const { day, time, isToday } = formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: false,
        day,
        time,
        isToday,
      };
    }

    case "breakpoint": {
      const { day, time, isToday } = formatAddTime(entry.add_time);
      return {
        ...base,
        message: entry.message || "",
        day,
        time,
        isToday,
      };
    }

    case "talkset":
    case "message":
      return {
        ...base,
        message: entry.message,
      };

    default:
      throw new Error(`Unknown entry type: ${(entry as any).entry_type}`);
  }
}

/**
 * Extracts the entries array from a flowsheet API response,
 * handling both bare-array (V1) and paginated-wrapper (V2) formats.
 */
export function extractFlowsheetEntries(
  response: FlowsheetV2PaginatedResponseJSON | FlowsheetV2EntryJSON[]
): FlowsheetV2EntryJSON[] {
  return Array.isArray(response) ? response : response.entries;
}

export function convertV2FlowsheetResponse(
  entries: FlowsheetV2EntryJSON[]
): FlowsheetEntry[] {
  return entries
    .map(convertV2Entry)
    .sort((a, b) => b.id - a.id);
}
