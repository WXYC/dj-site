import { describe, expect, it } from "vitest";
import type { SmartField } from "./parser/types";
import {
  cycleTriggerField,
  nextTriggerField,
  TRIGGER_WORD,
  type TriggerField,
} from "./triggerWords";

/** Build an isClaimed predicate from a set of claimed field names. */
const claimed = (...fields: SmartField[]) => {
  const set = new Set<SmartField>(fields);
  return (field: SmartField) => set.has(field);
};

/** Build a hasValue predicate from a set of value-bearing fields. */
const withValues = (...fields: TriggerField[]) => {
  const set = new Set<TriggerField>(fields);
  return (field: TriggerField) => set.has(field);
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

describe("cycleTriggerField", () => {
  it("steps artist → album → label → (none) with no fields filled", () => {
    const none = withValues();
    expect(cycleTriggerField("artist", none)).toBe("album");
    expect(cycleTriggerField("album", none)).toBe("label");
    expect(cycleTriggerField("label", none)).toBeNull();
  });

  it("skips a field that already holds a value", () => {
    // album is filled → cycling the artist trigger jumps straight to label
    expect(cycleTriggerField("artist", withValues("album"))).toBe("label");
    // and label is then the last open field
    expect(cycleTriggerField("label", withValues("album"))).toBeNull();
  });

  it("returns null when the current field is the last open one", () => {
    expect(cycleTriggerField("artist", withValues("album", "label"))).toBeNull();
  });
});
