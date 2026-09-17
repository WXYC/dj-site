import { describe, it, expect } from "vitest";
import {
  formatShortDate,
  formatShortTime,
} from "@/src/components/experiences/classic/flowsheet/marker-format";

describe("formatShortDate", () => {
  it("shortens a formatAddTime-shaped day string", () => {
    expect(formatShortDate("11/14/2023")).toBe("11/14/23");
  });

  it("returns the input unchanged when it doesn't match the expected pattern", () => {
    expect(formatShortDate("not a time")).toBe("not a time");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
  ])("returns '' rather than throwing for %s", (_label, value) => {
    expect(formatShortDate(value)).toBe("");
  });
});

describe("formatShortTime", () => {
  it("shortens a formatAddTime-shaped time string", () => {
    expect(formatShortTime("5:13:00 PM")).toBe("5:13 PM");
  });

  it("returns the input unchanged when it doesn't match the expected pattern", () => {
    expect(formatShortTime("not a time")).toBe("not a time");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
  ])("returns '' rather than throwing for %s", (_label, value) => {
    expect(formatShortTime(value)).toBe("");
  });
});
