import { describe, it, expect } from "vitest";
import {
  initialSmartEntryState,
  smartEntryReducer,
  hasActiveTrigger,
  type SmartEntryState,
} from "./smartEntryState";
import { parseSmartEntry } from "./parser/parseSmartEntry";

const state = (overrides: Partial<SmartEntryState> = {}): SmartEntryState => ({
  ...initialSmartEntryState,
  ...overrides,
});

describe("smartEntryReducer", () => {
  describe("SET_RAW", () => {
    it("stores the new raw text", () => {
      const next = smartEntryReducer(state(), {
        type: "SET_RAW",
        raw: "Percolator by Stereolab",
      });
      expect(next.raw).toBe("Percolator by Stereolab");
    });

    it("clears a dismissed-ghost memo on any edit", () => {
      const start = state({
        raw: "Ste",
        dismissedGhost: { field: "artist", prefix: "Ste" },
      });
      const next = smartEntryReducer(start, { type: "SET_RAW", raw: "Ster" });
      expect(next.dismissedGhost).toBeNull();
    });

    it("keeps a lock while its field value is unchanged", () => {
      const start = state({
        raw: "Percolator by Stereolab",
        locks: { artist: "Stereolab" },
      });
      const next = smartEntryReducer(start, {
        type: "SET_RAW",
        raw: "Percolator 2 by Stereolab",
      });
      expect(next.locks.artist).toBe("Stereolab");
    });

    it("drops a lock when its field value changes (edit-to-unlock)", () => {
      const start = state({
        raw: "by Stereolab",
        locks: { artist: "Stereolab" },
      });
      const next = smartEntryReducer(start, {
        type: "SET_RAW",
        raw: "by Stereolen",
      });
      expect(next.locks.artist).toBeUndefined();
    });

    it("remaps a suppressed-trigger offset across an edit before it", () => {
      // "Standing on the Corner" with "on"@9 suppressed; prepend "The ".
      const start = state({
        raw: "Standing on the Corner",
        suppressedTriggers: [9],
      });
      const next = smartEntryReducer(start, {
        type: "SET_RAW",
        raw: "The Standing on the Corner",
      });
      expect(next.suppressedTriggers).toEqual([13]);
    });

    it("drops a suppression when the escaped word itself is edited", () => {
      const start = state({
        raw: "Standing on the Corner",
        suppressedTriggers: [9],
      });
      const next = smartEntryReducer(start, {
        type: "SET_RAW",
        raw: "Standing onn the Corner",
      });
      expect(next.suppressedTriggers).toEqual([]);
    });
  });

  describe("ACCEPT_GHOST", () => {
    it("replaces raw and locks the accepted field", () => {
      const start = state({ raw: "by Ju" });
      const next = smartEntryReducer(start, {
        type: "ACCEPT_GHOST",
        raw: "by Juana Molina",
        field: "artist",
        value: "Juana Molina",
      });
      expect(next.raw).toBe("by Juana Molina");
      expect(next.locks.artist).toBe("Juana Molina");
    });

    it("auto-escapes a trigger word inside the accepted value", () => {
      // Accepting an album that contains "With" must keep the album whole — the
      // inner "with" is suppressed so it isn't read as a label trigger.
      const raw = "Song on Songs With Strangers";
      const start = state({ raw: "Song on Songs Wi" });
      const next = smartEntryReducer(start, {
        type: "ACCEPT_GHOST",
        raw,
        field: "album",
        value: "Songs With Strangers",
      });
      const withOffset = raw.indexOf("With");
      expect(next.suppressedTriggers).toContain(withOffset);
      // And the parse keeps the album intact.
      const parse = parseSmartEntry(next.raw, {
        suppressedTriggers: next.suppressedTriggers,
      });
      expect(parse.fields.album).toBe("Songs With Strangers");
      expect(parse.fields.label).toBeUndefined();
    });

    it("does not suppress the field's own leading trigger", () => {
      const raw = "Song on Songs With Strangers";
      const start = state({ raw: "Song on Songs Wi" });
      const next = smartEntryReducer(start, {
        type: "ACCEPT_GHOST",
        raw,
        field: "album",
        value: "Songs With Strangers",
      });
      // "on" (the album trigger) precedes the value and must stay active.
      expect(next.suppressedTriggers).not.toContain(raw.indexOf("on"));
    });
  });

  describe("LOCK_FIELD", () => {
    it("locks a field without changing raw", () => {
      const start = state({ raw: "anything" });
      const next = smartEntryReducer(start, {
        type: "LOCK_FIELD",
        field: "album",
        value: "Dots and Loops",
      });
      expect(next.raw).toBe("anything");
      expect(next.locks.album).toBe("Dots and Loops");
    });
  });

  describe("DISMISS_GHOST", () => {
    it("records the dismissed (field, prefix)", () => {
      const next = smartEntryReducer(state({ raw: "Ste" }), {
        type: "DISMISS_GHOST",
        field: "artist",
        prefix: "Ste",
      });
      expect(next.dismissedGhost).toEqual({ field: "artist", prefix: "Ste" });
    });
  });

  describe("SUPPRESS_NEWEST_TRIGGER", () => {
    it("suppresses the only active trigger", () => {
      const raw = "Standing on the Corner";
      const next = smartEntryReducer(state({ raw }), {
        type: "SUPPRESS_NEWEST_TRIGGER",
      });
      // "on" is at offset 9.
      expect(next.suppressedTriggers).toEqual([9]);
    });

    it("suppresses the newest (right-most) trigger first", () => {
      // "Standing on the Corner by X" — triggers on@9 and by@23; suppress by@23.
      const raw = "Standing on the Corner by X";
      const next = smartEntryReducer(state({ raw }), {
        type: "SUPPRESS_NEWEST_TRIGGER",
      });
      expect(next.suppressedTriggers).toEqual([23]);
    });

    it("then suppresses the next-newest on a second press", () => {
      const raw = "Standing on the Corner by X";
      const once = smartEntryReducer(state({ raw }), {
        type: "SUPPRESS_NEWEST_TRIGGER",
      });
      const twice = smartEntryReducer(once, {
        type: "SUPPRESS_NEWEST_TRIGGER",
      });
      expect(twice.suppressedTriggers.sort((a, b) => a - b)).toEqual([9, 23]);
    });

    it("is a no-op when there are no active triggers", () => {
      const start = state({ raw: "Just a title" });
      const next = smartEntryReducer(start, {
        type: "SUPPRESS_NEWEST_TRIGGER",
      });
      expect(next).toBe(start);
    });
  });

  it("CLEAR_LOCKS empties all locks", () => {
    const start = state({ locks: { artist: "A", album: "B" } });
    expect(smartEntryReducer(start, { type: "CLEAR_LOCKS" }).locks).toEqual({});
  });

  it("RESET returns the initial state", () => {
    const start = state({ raw: "x", locks: { artist: "A" }, suppressedTriggers: [1] });
    expect(smartEntryReducer(start, { type: "RESET" })).toEqual(
      initialSmartEntryState
    );
  });
});

describe("hasActiveTrigger", () => {
  it("is true when an unsuppressed trigger is present", () => {
    expect(hasActiveTrigger(state({ raw: "Song by Artist" }))).toBe(true);
  });

  it("is false for plain title text", () => {
    expect(hasActiveTrigger(state({ raw: "Just a title" }))).toBe(false);
  });

  it("is false once the only trigger is suppressed", () => {
    expect(
      hasActiveTrigger(state({ raw: "Standing on the Corner", suppressedTriggers: [9] }))
    ).toBe(false);
  });
});
