import { describe, it, expect } from "vitest";
import { hasNothingToShow } from "@/lib/has-nothing-to-show";

describe("hasNothingToShow", () => {
  it.each([
    ["an error and no data", { isError: true, data: undefined }, true],
    ["an error and null data", { isError: true, data: null }, true],
    ["an error over last-good data", { isError: true, data: [] }, false],
    ["data and no error", { isError: false, data: [1] }, false],
    ["a read that never went out", { isError: false, data: undefined }, false],
  ])("is %s -> %s", (_label, query, expected) => {
    expect(hasNothingToShow(query)).toBe(expected);
  });
});
