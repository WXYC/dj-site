import { FlowsheetSongEntry } from "./types";

const QUEUE_STORAGE_KEY = "wxyc_flowsheet_queue";

function isValidQueueEntry(entry: unknown): entry is FlowsheetSongEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "number" &&
    typeof e.track_title === "string" &&
    typeof e.artist_name === "string" &&
    typeof e.album_title === "string" &&
    typeof e.record_label === "string" &&
    typeof e.request_flag === "boolean"
  );
}

export const loadQueueFromStorage = (): FlowsheetSongEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQueueEntry);
  } catch (error) {
    console.error("Failed to load queue from localStorage:", error);
    return [];
  }
};

// Save queue to localStorage
export const saveQueueToStorage = (queue: FlowsheetSongEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Failed to save queue to localStorage:", error);
  }
};

// Clear queue from localStorage
export const clearQueueFromStorage = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear queue from localStorage:", error);
  }
};
