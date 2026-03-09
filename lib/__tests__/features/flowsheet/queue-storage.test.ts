import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadQueueFromStorage,
  saveQueueToStorage,
  clearQueueFromStorage,
} from "@/lib/features/flowsheet/queue-storage";
import { createTestFlowsheetEntry } from "@/lib/test-utils";

const QUEUE_STORAGE_KEY = "wxyc_flowsheet_queue";

describe("queue-storage (Bug 33)", () => {
  let store: Record<string, string> = {};
  const realLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, "localStorage", { value: realLocalStorage, writable: true });
  });

  afterEach(() => {
    store = {};
  });

  describe("loadQueueFromStorage", () => {
    it("should return an empty array when nothing is stored", () => {
      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("should return valid queue entries from localStorage", () => {
      const entries = [createTestFlowsheetEntry({ id: 1 }), createTestFlowsheetEntry({ id: 2 })];
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(entries));

      const result = loadQueueFromStorage();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should return an empty array for invalid JSON", () => {
      localStorage.setItem(QUEUE_STORAGE_KEY, "not valid json{{{");
      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("should filter out entries missing required fields", () => {
      const data = [
        { bad: "data", missing: "required fields" },
        createTestFlowsheetEntry({ id: 10 }),
        { id: 5 },
        null,
        "not an object",
      ];
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(data));

      const result = loadQueueFromStorage();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
    });

    it("should filter out non-array stored values", () => {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ id: 1 }));
      expect(loadQueueFromStorage()).toEqual([]);
    });

    it("should filter out entries where id is not a number", () => {
      const data = [
        { ...createTestFlowsheetEntry(), id: "not-a-number" },
      ];
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(data));
      expect(loadQueueFromStorage()).toEqual([]);
    });
  });

  describe("saveQueueToStorage", () => {
    it("should save queue entries to localStorage", () => {
      const entries = [createTestFlowsheetEntry({ id: 42 })];
      saveQueueToStorage(entries);

      const stored = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(42);
    });
  });

  describe("clearQueueFromStorage", () => {
    it("should remove the queue from localStorage", () => {
      localStorage.setItem(QUEUE_STORAGE_KEY, "some data");
      clearQueueFromStorage();
      expect(localStorage.getItem(QUEUE_STORAGE_KEY)).toBeNull();
    });
  });
});
