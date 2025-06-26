import { Rotation } from "../rotation/types";
import {
  FlowsheetBreakpointEntry,
  FlowsheetEntryResponse,
  FlowsheetMessageEntry,
  FlowsheetQuery,
  FlowsheetShowBlockEntry,
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
  OnAirDJData,
  OnAirDJResponse,
} from "./types";

export function convertFlowsheetResponse(entries: FlowsheetEntryResponse[]) {
  return entries
    .map((entry) => {
      if (entry.message) {
        if (entry.message.includes("Start of Show")) {
          return convertToStartShow(entry);
        } else if (entry.message.includes("End of Show")) {
          return convertToEndShow(entry);
        } else if (entry.message.includes("Breakpoint")) {
          return convertToBreakpoint(entry);
        } else {
          return convertToMessage(entry);
        }
      } else {
        return convertToSong(entry);
      }
    })
    .sort((a, b) => b.play_order - a.play_order);
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
    rotation: response.rotation_play_freq as Rotation,
  };
}

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

export function convertToStartShow(
  response: FlowsheetEntryResponse
): FlowsheetShowBlockEntry {
  let djNameExtractionRegex =
    /Start of Show:\s*([A-Za-z\s]+)\s+joined the set/i;
  let djName =
    response.message?.match(djNameExtractionRegex)?.[1] || "Unknown DJ";

  let datetimeExtractionRegex =
    /(\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*[APM]*)/i;
  let dateString =
    response.message?.match(datetimeExtractionRegex)?.[1] ||
    "Unknown Date or Time";
  let isUnknown = dateString === "Unknown Date or Time";

  let day = isUnknown ? "Unknown" : dateString.split(",")[0].trim();
  let time = isUnknown ? "Unknown" : dateString.split(",")[1].trim();

  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    dj_name: djName,
    day: day,
    time: time,
    isStart: true,
  };
}

export function convertToEndShow(
  response: FlowsheetEntryResponse
): FlowsheetShowBlockEntry {
  let djNameExtractionRegex = /End of Show:\s*([A-Za-z\s]+)\s+left the set/i;
  let djName =
    response.message?.match(djNameExtractionRegex)?.[1] || "Unknown DJ";

  let datetimeExtractionRegex =
    /(\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s*[APM]*)/i;
  let dateString =
    response.message?.match(datetimeExtractionRegex)?.[1] ||
    "Unknown Date or Time";
  let isUnknown = dateString === "Unknown Date or Time";

  let day = isUnknown ? "Unknown" : dateString.split(",")[0].trim();
  let time = isUnknown ? "Unknown" : dateString.split(",")[1].trim();

  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    dj_name: djName,
    day: day,
    time: time,
    isStart: false,
  };
}

export function convertToBreakpoint(
  response: FlowsheetEntryResponse
): FlowsheetBreakpointEntry {
  let datetimeExtractionRegex = /(\d{1,2}:\d{2}\s?[APMapm]{2})/g;
  let dateString =
    response.message?.match(datetimeExtractionRegex)?.[1] ||
    "Unknown Date or Time";
  let isUnknown = dateString === "Unknown Date or Time";

  let day = isUnknown ? "Unknown" : dateString.split(",")[0].trim();
  let time = isUnknown ? "Unknown" : dateString.split(",")[1].trim();

  return {
    id: response.id,
    play_order: response.play_order,
    show_id: response.show_id,
    message: response.message || "",
    day: day,
    time: time,
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
