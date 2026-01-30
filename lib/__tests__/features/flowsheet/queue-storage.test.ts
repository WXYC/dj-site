import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadQueueFromStorage,
  saveQueueToStorage,
  clearQueueFromStorage,
} from "@/lib/features/flowsheet/queue-storage";
import { createTestFlowsheetEntry } from "@/lib/test-utils";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

describe("queue-storage", () => {
  const QUEUE_STORAGE_KEY = "wxyc_flowsheet_queue";

  beforeEach(() => {
    // Reset the mocked localStorage between tests
    vi.mocked(window.localStorage.getItem).mockReset();
    vi.mocked(window.localStorage.setItem).mockReset();
    vi.mocked(window.localStorage.removeItem).mockReset();
  });

  describe("loadQueueFromStorage", () => {
    it("should return empty array when localStorage is empty", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);
      const result = loadQueueFromStorage();
      expect(result).toEqual([]);
      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        QUEUE_STORAGE_KEY
      );
    });

    it("should parse and return stored queue data", () => {
      const storedQueue: FlowsheetSongEntry[] = [
        createTestFlowsheetEntry({ id: 1, track_title: "Track 1" }),
        createTestFlowsheetEntry({ id: 2, track_title: "Track 2" }),
      ];
      vi.mocked(window.localStorage.getItem).mockReturnValue(
        JSON.stringify(storedQueue)
      );

      const result = loadQueueFromStorage();

      expect(result).toHaveLength(2);
      expect(result[0].track_title).toBe("Track 1");
      expect(result[1].track_title).toBe("Track 2");
    });

    it("should return empty array on parse error", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(window.localStorage.getItem).mockReturnValue("invalid json{");

      const result = loadQueueFromStorage();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load queue from localStorage:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("should return empty array on empty string", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue("");
      const result = loadQueueFromStorage();
      expect(result).toEqual([]);
    });
  });

  describe("saveQueueToStorage", () => {
    it("should save queue to localStorage", () => {
      const queue: FlowsheetSongEntry[] = [
        createTestFlowsheetEntry({ id: 1, track_title: "Track 1" }),
      ];

      saveQueueToStorage(queue);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        QUEUE_STORAGE_KEY,
        JSON.stringify(queue)
      );
    });

    it("should save empty queue", () => {
      saveQueueToStorage([]);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        QUEUE_STORAGE_KEY,
        "[]"
      );
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("Storage quota exceeded");
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw error;
      });

      saveQueueToStorage([createTestFlowsheetEntry()]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save queue to localStorage:",
        error
      );
      consoleSpy.mockRestore();
    });

    it("should save queue with multiple entries", () => {
      const queue: FlowsheetSongEntry[] = [
        createTestFlowsheetEntry({ id: 1, track_title: "Track 1" }),
        createTestFlowsheetEntry({ id: 2, track_title: "Track 2" }),
        createTestFlowsheetEntry({ id: 3, track_title: "Track 3" }),
      ];

      saveQueueToStorage(queue);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        QUEUE_STORAGE_KEY,
        JSON.stringify(queue)
      );
    });
  });

  describe("clearQueueFromStorage", () => {
    it("should remove queue from localStorage", () => {
      clearQueueFromStorage();

      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        QUEUE_STORAGE_KEY
      );
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("Storage error");
      vi.mocked(window.localStorage.removeItem).mockImplementation(() => {
        throw error;
      });

      clearQueueFromStorage();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to clear queue from localStorage:",
        error
      );
      consoleSpy.mockRestore();
    });
  });
});
