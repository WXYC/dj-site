import { Rotation } from "../rotation/types";
import {
  FlowsheetEntry,
  FlowsheetQuery,
  FlowsheetSubmissionParams,
  FlowsheetV2EntryJSON,
  FlowsheetV2PaginatedResponseJSON,
  OnAirDJData,
  OnAirDJResponse,
} from "./types";

export function convertQueryToSubmission(
  query: FlowsheetQuery
): FlowsheetSubmissionParams {
  return {
    track_title: query.song,
    artist_name: query.artist,
    album_title: query.album,
    record_label: query.label,
    request_flag: query.request,
    album_id: query.album_id,
    rotation_id: query.rotation_id,
  };
}

export function convertDJsOnAir(
  response: OnAirDJResponse[] | undefined
): OnAirDJData {
  if (!response || response.length === 0) {
    return {
      djs: [],
      onAir: "Off Air",
    };
  }

  return {
    djs: response,
    onAir: response.map((dj) => `DJ ${dj.dj_name}`).join(", "),
  };
}

// V2 conversion functions

function parseTimestamp(timestamp: string): { day: string; time: string } {
  if (!timestamp) {
    return { day: "Unknown", time: "Unknown" };
  }
  const commaIndex = timestamp.indexOf(",");
  if (commaIndex === -1) {
    return { day: "Unknown", time: "Unknown" };
  }
  return {
    day: timestamp.substring(0, commaIndex).trim(),
    time: timestamp.substring(commaIndex + 1).trim(),
  };
}

function formatAddTime(isoString: string): { day: string; time: string } {
  const date = new Date(isoString);
  const day = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return { day, time: `${h}:${m}:${s} ${ampm}` };
}

export function convertV2Entry(entry: FlowsheetV2EntryJSON): FlowsheetEntry {
  const base = {
    id: entry.id,
    play_order: entry.play_order,
    show_id: entry.show_id ?? 0,
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
        album_id: entry.album_id ?? undefined,
        rotation_id: entry.rotation_id ?? undefined,
        rotation: entry.rotation_bin as Rotation,
      };

    case "show_start": {
      const { day, time } = parseTimestamp(entry.timestamp);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: true,
        day,
        time,
      };
    }

    case "show_end": {
      const { day, time } = parseTimestamp(entry.timestamp);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: false,
        day,
        time,
      };
    }

    case "dj_join": {
      const { day, time } = formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: true,
        day,
        time,
      };
    }

    case "dj_leave": {
      const { day, time } = formatAddTime(entry.add_time);
      return {
        ...base,
        dj_name: entry.dj_name,
        isStart: false,
        day,
        time,
      };
    }

    case "breakpoint": {
      const { day, time } = formatAddTime(entry.add_time);
      return {
        ...base,
        message: entry.message || "",
        day,
        time,
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
    .sort((a, b) => b.play_order - a.play_order);
}
