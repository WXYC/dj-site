import { createAppSlice } from "@/lib/createAppSlice";
import { PayloadAction } from "@reduxjs/toolkit";
import { FlowsheetEntry, FlowsheetFrontendState, FlowsheetQuery, FlowsheetRequestParams, FlowsheetSearchProperty, FlowsheetSongEntry, FlowsheetSwitchParams } from "./types";

const QUEUE_STORAGE_KEY = "wxyc_flowsheet_queue";

// Load queue from localStorage
export const loadQueueFromStorage = (): FlowsheetSongEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
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
