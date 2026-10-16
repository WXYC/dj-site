import { describe, it, expect } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { byKind, isFiledState, recordKind, showsAsDigital } from "@/lib/features/reviews/kind";
import { CDR_FORMAT, digitalItem, intakeItem } from "@/tests/fakes/reviews";

describe("record kind", () => {
  it.each<[string, Partial<IntakeItem>, "digital" | "disc", boolean]>([
    ["a disc on the review shelf", { digital: false }, "disc", false],
    ["a digital album on the review shelf", { digital: true }, "digital", true],
    ["a digital album checked out", { digital: true, effective_state: "checked_out" }, "digital", true],
    ["a digital album that is reviewed", { digital: true, effective_state: "reviewed" }, "digital", true],
    ["a filed digital album", { digital: true, effective_state: "filed", filed_at: "2026-10-01T12:00:00Z" }, "digital", false],
    ["a finalized digital album", { digital: true, effective_state: "finalized", filed_at: "2026-10-01T12:00:00Z" }, "digital", false],
    ["a filed digital album with no filing time", { digital: true, effective_state: "filed", filed_at: null }, "digital", false],
    ["a filed disc", { digital: false, effective_state: "filed" }, "disc", false],
  ])("%s", (_name, overrides, kind, shows) => {
    const item = overrides.digital ? digitalItem(overrides) : intakeItem(overrides);
    expect(recordKind(item)).toBe(kind);
    expect(showsAsDigital(item)).toBe(shows);
    expect(byKind(item, { disc: "a disc", digital: "a file" })).toBe(kind === "digital" ? "a file" : "a disc");
  });

  it.each([
    ["pool", false],
    ["requested", false],
    ["checked_out", false],
    ["reviewed", false],
    ["filed", true],
    ["finalized", true],
  ] as const)("isFiledState(%s) is %s", (state, filed) => {
    expect(isFiledState(state)).toBe(filed);
  });

  it("builds the digital preset on the item factory under the CD-R format, never the disc default", () => {
    const item = digitalItem({ artist_name: "Juana Molina" });
    expect(item).toEqual({ ...intakeItem({ artist_name: "Juana Molina" }), digital: true, format_id: CDR_FORMAT.id });
    expect(item.format_id).not.toBe(intakeItem().format_id);
  });
});
