import { describe, expect, it } from "vitest";
import { EntryFieldName, entryFieldTextColor } from "./entryFieldColors";

const METADATA: EntryFieldName[] = ["artist", "album", "label"];

describe("entryFieldColors", () => {
  it("gives the song title the primary text color", () => {
    expect(entryFieldTextColor("song", false)).toBe("text.primary");
  });

  it("dims the metadata fields to one secondary level", () => {
    for (const field of METADATA) {
      expect(entryFieldTextColor(field, false)).toBe("text.secondary");
    }
  });

  it("keeps the title bright and metadata dimmed on the playing row", () => {
    expect(entryFieldTextColor("song", true)).toBe("common.white");
    for (const field of METADATA) {
      expect(entryFieldTextColor(field, true)).toBe("rgba(255, 255, 255, 0.72)");
    }
  });
});
