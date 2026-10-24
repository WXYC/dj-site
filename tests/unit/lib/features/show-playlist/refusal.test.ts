import { describe, it, expect } from "vitest";
import {
  markRefusal,
  refusalSentenceOf,
} from "@/lib/features/show-playlist/api";

const marked = markRefusal({ badRequest: "Pick a program." })(
  { status: 400, data: null },
  undefined,
  undefined
);

describe("refusalSentenceOf", () => {
  it.each([
    ["a marked rejection", marked, "Pick a program."],
    ["a result.error", { error: marked }.error, "Pick a program."],
    ["an unmarked error", { status: 500, data: null }, null],
    ["a non-string sentence", { sentence: 3 }, null],
    ["null", null, null],
    ["undefined", undefined, null],
  ])("reads %s", (_name, error, expected) => {
    expect(refusalSentenceOf(error)).toBe(expected);
  });
});
