import { describe, expect, it } from "vitest";
import { insertTriggerWord } from "./insertTriggerWord";

describe("insertTriggerWord", () => {
  it("appends the trigger with a leading space when caret is at the end", () => {
    const raw = "Vitamin C";
    const { raw: out, caret } = insertTriggerWord(raw, raw.length, raw.length, "by");
    expect(out).toBe("Vitamin C by ");
    expect(caret).toBe(out.length);
  });

  it("adds no leading space when the text already ends with one", () => {
    const raw = "Vitamin C ";
    const { raw: out } = insertTriggerWord(raw, raw.length, raw.length, "by");
    expect(out).toBe("Vitamin C by ");
  });

  it("adds no leading space at the very start", () => {
    const { raw: out, caret } = insertTriggerWord("", 0, 0, "on");
    expect(out).toBe("on ");
    expect(caret).toBe("on ".length);
  });

  it("splices at a mid-string caret and separates from the following value", () => {
    // caret sits right after "Song"
    const raw = "Song Album";
    const { raw: out, caret } = insertTriggerWord(raw, 4, 4, "on");
    expect(out).toBe("Song on Album");
    expect(caret).toBe("Song on ".length);
  });

  it("collapses whitespace that already led the following text", () => {
    const raw = "Song  Album"; // caret after "Song"
    const { raw: out } = insertTriggerWord(raw, 4, 4, "on");
    expect(out).toBe("Song on Album");
  });

  it("replaces a selected range", () => {
    const raw = "Song XXX Album";
    // select the "XXX"
    const { raw: out } = insertTriggerWord(raw, 5, 8, "via");
    expect(out).toBe("Song via Album");
  });
});
