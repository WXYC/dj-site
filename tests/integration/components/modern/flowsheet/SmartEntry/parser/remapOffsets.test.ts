import { describe, it, expect } from "vitest";
import { diffSplice, remapSuppressedTriggers } from "@/src/components/experiences/modern/flowsheet/SmartEntry/parser/remapOffsets";

describe("diffSplice", () => {
  it("detects a pure insertion", () => {
    expect(diffSplice("abcd", "abXYcd")).toEqual({
      start: 2,
      removed: 0,
      inserted: 2,
    });
  });

  it("detects a pure deletion", () => {
    expect(diffSplice("abXYcd", "abcd")).toEqual({
      start: 2,
      removed: 2,
      inserted: 0,
    });
  });

  it("detects a replacement", () => {
    expect(diffSplice("abXYcd", "abZcd")).toEqual({
      start: 2,
      removed: 2,
      inserted: 1,
    });
  });

  it("detects append at end", () => {
    expect(diffSplice("abc", "abcdef")).toEqual({
      start: 3,
      removed: 0,
      inserted: 3,
    });
  });

  it("detects prepend at start", () => {
    expect(diffSplice("cd", "abcd")).toEqual({
      start: 0,
      removed: 0,
      inserted: 2,
    });
  });

  it("is a no-op splice for identical strings", () => {
    expect(diffSplice("abc", "abc")).toEqual({
      start: 3,
      removed: 0,
      inserted: 0,
    });
  });
});

describe("remapSuppressedTriggers", () => {
  it("returns [] when nothing is suppressed", () => {
    expect(remapSuppressedTriggers("Standing on x", "Standing on xy", [])).toEqual(
      []
    );
  });

  it("keeps a suppressed word unchanged when the edit is after it", () => {
    // "Standing on the Corner" — "on" @9 suppressed; append more text.
    const oldRaw = "Standing on the Corner";
    const newRaw = "Standing on the Corner by Can";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9])).toEqual([9]);
  });

  it("shifts a suppressed word when text is inserted before it", () => {
    // Insert "The " at offset 0; the "on" @9 moves to @13.
    const oldRaw = "Standing on the Corner";
    const newRaw = "The Standing on the Corner";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9])).toEqual([13]);
  });

  it("shifts a suppressed word when text is deleted before it", () => {
    // Delete "Standing " (9 chars) at offset 0; "on" moves from @9 to @0.
    const oldRaw = "Standing on the Corner";
    const newRaw = "on the Corner";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9])).toEqual([0]);
  });

  it("drops a suppression when the escaped word itself is edited (re-invoke)", () => {
    // Retype the suppressed "on" as "onn" — the edit overlaps the word, so the
    // suppression drops and the trigger becomes active again.
    const oldRaw = "Standing on the Corner";
    const newRaw = "Standing onn the Corner";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9])).toEqual([]);
  });

  it("remaps multiple suppressions independently across one edit", () => {
    // "Standing on the Corner by Standing on the Corner" — on@9 and on@35.
    // Prepend "The " (4 chars) at offset 0: both shift by 4.
    const oldRaw = "Standing on the Corner by Standing on the Corner";
    const newRaw = "The Standing on the Corner by Standing on the Corner";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9, 35])).toEqual([13, 39]);
  });

  it("keeps an earlier suppression and shifts a later one when editing between them", () => {
    // Insert "X" between the two words; on@9 unchanged, on@35 shifts +1.
    const oldRaw = "Standing on the Corner by Standing on the Corner";
    const newRaw = "Standing on the CornerX by Standing on the Corner";
    expect(remapSuppressedTriggers(oldRaw, newRaw, [9, 35])).toEqual([9, 36]);
  });
});
