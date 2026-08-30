import { describe, it, expect } from "vitest";
import {
  formatNameList,
  nonBlankNames,
} from "@/lib/features/flowsheet/name-list";

describe("nonBlankNames", () => {
  it.each([
    [[], []],
    [["dj sue"], ["dj sue"]],
    [["", "  ", "dj sue"], ["dj sue"]],
    [["  dj sue  ", "eureka!"], ["dj sue", "eureka!"]],
    [["", "   "], []],
  ])("filters %j to %j", (names, expected) => {
    expect(nonBlankNames(names)).toEqual(expected);
  });
});

describe("formatNameList", () => {
  // The two axes callers are meant to differ on: the empty-list fallback
  // text, and whether a conjunction joins the final name.
  describe("with a conjunction (formatDjNames' style)", () => {
    const style = { whenEmpty: "Someone", conjunction: "and" };

    it.each([
      [[], "Someone"],
      [["dj sue"], "dj sue"],
      [["dj sue", "eureka!"], "dj sue and eureka!"],
      [["dj sue", "eureka!", "DJ boy"], "dj sue, eureka! and DJ boy"],
      [["", "  ", "dj sue"], "dj sue"],
      [["", "   "], "Someone"],
    ])("formats %j as %s", (names, expected) => {
      expect(formatNameList(names, style)).toBe(expected);
    });
  });

  // A plain comma join, no conjunction word — formatOnAirSummary's style.
  describe("without a conjunction (formatOnAirSummary's style)", () => {
    const style = { whenEmpty: "Off Air" };

    it.each([
      [[], "Off Air"],
      [["Turncoat"], "Turncoat"],
      [["Turncoat", "desire path"], "Turncoat, desire path"],
      [["Turncoat", "desire path", "Marz"], "Turncoat, desire path, Marz"],
      [["Turncoat", ""], "Turncoat"],
      [["", "   "], "Off Air"],
    ])("formats %j as %s", (names, expected) => {
      expect(formatNameList(names, style)).toBe(expected);
    });
  });

  // A count from `nonBlankNames` and a render from `formatNameList`, over the
  // same input, cannot disagree — no "dj sue are on air" for one visible name.
  it("a count taken from nonBlankNames always agrees with the list formatNameList renders", () => {
    const raw = ["dj sue", "  ", ""];
    const filtered = nonBlankNames(raw);
    const rendered = formatNameList(raw, { whenEmpty: "Someone", conjunction: "and" });

    expect(filtered).toHaveLength(1);
    expect(rendered).toBe("dj sue");
    // A verb chosen from filtered.length ("is" for 1) agrees with rendered:
    // singular count, singular-looking name, never "dj sue are on air".
  });
});
