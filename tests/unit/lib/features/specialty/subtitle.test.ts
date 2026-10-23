import { describe, it, expect } from "vitest";
import { specialtySubtitle } from "@/lib/features/specialty/subtitle";

const program = { name: "Orange County Special" };

describe("specialtySubtitle", () => {
  it.each([
    ["a title that differs from the program name", program, "Pumpkin Spice Special", "Pumpkin Spice Special"],
    ["a title equal to the program name", program, "Orange County Special", null],
    ["an empty title", program, "", null],
    ["a null title", program, null, null],
    ["an undefined title", program, undefined, null],
    ["an untagged set", null, "Pumpkin Spice Special", null],
  ])("returns the right subtitle for %s", (_name, specialty, showName, expected) => {
    expect(specialtySubtitle(specialty, showName)).toBe(expected);
  });
});
