import { describe, expect, it } from "vitest";
import {
  ENTRY_FIELD_COLOR,
  EntryFieldName,
  entryFieldTextColor,
} from "./entryFieldColors";

const FIELDS: EntryFieldName[] = ["song", "artist", "album", "label"];

describe("entryFieldColors", () => {
  it("defines a color for every entry field", () => {
    for (const field of FIELDS) {
      expect(ENTRY_FIELD_COLOR[field]).toBeDefined();
    }
  });

  it("inverts every tint to white on the solid playing row", () => {
    for (const field of FIELDS) {
      expect(entryFieldTextColor(field, true)).toBe("common.white");
    }
  });

  it("tints fields by palette and leaves the song plain", () => {
    expect(entryFieldTextColor("song", false)).toBe("text.primary");
    expect(entryFieldTextColor("artist", false)).toBe("primary.plainColor");
    expect(entryFieldTextColor("album", false)).toBe("success.plainColor");
    expect(entryFieldTextColor("label", false)).toBe("warning.plainColor");
  });
});
