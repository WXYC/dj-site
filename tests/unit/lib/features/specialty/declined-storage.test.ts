import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readDeclinedShows,
  rememberDeclinedShow,
} from "@/lib/features/specialty/declined-storage";

describe("declined-storage", () => {
  let stored: string | null;

  beforeEach(() => {
    stored = null;
    vi.mocked(localStorage.getItem).mockImplementation(() => stored);
    vi.mocked(localStorage.setItem).mockImplementation((_key, value) => {
      stored = value;
    });
  });

  it.each([
    ["nothing stored", null],
    ["unparseable JSON", "{nope"],
    ["JSON that is not a list", '{"a":1}'],
  ])("reads an empty list for %s", (_label, value) => {
    stored = value;
    expect(readDeclinedShows()).toEqual([]);
  });

  it("keeps only numeric ids", () => {
    stored = '[3,"4",null,5]';
    expect(readDeclinedShows()).toEqual([3, 5]);
  });

  it("remembers the last twenty shows", () => {
    for (let id = 1; id <= 25; id += 1) {
      rememberDeclinedShow(id);
    }
    expect(readDeclinedShows()).toEqual(Array.from({ length: 20 }, (_, i) => i + 6));
  });

  it("swallows a storage that throws", () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error("denied");
    });
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readDeclinedShows()).toEqual([]);
    expect(() => rememberDeclinedShow(1)).not.toThrow();
  });
});
