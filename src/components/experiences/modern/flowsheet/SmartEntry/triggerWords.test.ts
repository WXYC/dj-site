import { describe, expect, it } from "vitest";
import type { SmartField } from "./parser/types";
import { nextTriggerField, TRIGGER_WORD } from "./triggerWords";

/** Build an isClaimed predicate from a set of claimed field names. */
const claimed = (...fields: SmartField[]) => {
  const set = new Set<SmartField>(fields);
  return (field: SmartField) => set.has(field);
};

describe("nextTriggerField", () => {
  it("is artist when nothing is specified yet (just a song)", () => {
    expect(nextTriggerField(claimed("song"))).toBe("artist");
  });

  it("skips a specified field to the next in order", () => {
    // song + album specified → the frontmost open field is still artist
    expect(nextTriggerField(claimed("song", "album"))).toBe("artist");
    // song + artist → album
    expect(nextTriggerField(claimed("song", "artist"))).toBe("album");
    // song + artist + album → label
    expect(nextTriggerField(claimed("song", "artist", "album"))).toBe("label");
  });

  it("returns null once every trigger field is specified", () => {
    expect(
      nextTriggerField(claimed("song", "artist", "album", "label"))
    ).toBeNull();
  });

  it("maps each field to its canonical word", () => {
    expect(TRIGGER_WORD.artist).toBe("by");
    expect(TRIGGER_WORD.album).toBe("on");
    expect(TRIGGER_WORD.label).toBe("via");
  });
});
