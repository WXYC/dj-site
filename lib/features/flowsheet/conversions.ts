import { Rotation } from "../catalog/types";
import {
  FlowsheetEndShowEntry,
  FlowsheetEntryResponse,
  FlowsheetMessageEntry,
  FlowsheetSongEntry,
  FlowsheetStartShowEntry,
} from "./types";

export function convertFlowsheetResponse(entries: FlowsheetEntryResponse[]) {
    return entries.map((entry) => {
        if (entry.message) {
            if (entry.message.includes("Start of Show")) {
                return convertToStartShow(entry);
            } else if (entry.message.includes("End of Show")) {
                return convertToEndShow(entry);
            } else {
                return convertToMessage(entry);
            }
        } else {
            return convertToSong(entry);
        }
    }).sort((a, b) => b.play_order - a.play_order);
}

export function convertToSong(
  response: FlowsheetEntryResponse
): FlowsheetSongEntry {
  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    track_title: response.track_title || "",
    artist_name: response.artist_name || "",
    album_title: response.album_title || "",
    record_label: response.record_label || "",
    request_flag: response.request_flag,
    album_id: response.album_id,
    rotation_id: response.rotation_id,
    rotation: (response.rotation_play_freq as Rotation),
  };
}

export function convertToStartShow(
  response: FlowsheetEntryResponse
): FlowsheetStartShowEntry {
  let djNameExtractionRegex =
    /Start of Show:\s*(DJ\s+[A-Za-z]+)\s+joined the set/i;
  let djName =
    response.message?.match(djNameExtractionRegex)?.[1] || "Unknown DJ";

  let datetimeExtractionRegex =
    /(\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*[APM]*)/i;
  let dateString =
    response.message?.match(datetimeExtractionRegex)?.[1] ||
    "Unknown Date or Time";

  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    dj_name: djName,
    date_string: dateString,
  };
}

export function convertToEndShow(
  response: FlowsheetEntryResponse
): FlowsheetEndShowEntry {
  let datetimeExtractionRegex =
    /(\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*[APM]*)/i;
  let dateString =
    response.message?.match(datetimeExtractionRegex)?.[1] ||
    "Unknown Date or Time";

  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    date_string: dateString,
  };
}

export function convertToMessage(
  response: FlowsheetEntryResponse
): FlowsheetMessageEntry {
  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    message: response.message || "",
  };
}
