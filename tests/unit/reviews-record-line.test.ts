import { describe, expect, it } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { intakeRecord, recordLine } from "@/src/components/experiences/modern/reviews/recordLine";

const formats = [
  { id: 1, format_name: "cd" },
  { id: 2, format_name: "vinyl" },
];

describe("recordLine", () => {
  it.each([
    ["a format id resolves to its name", { artist: "Cat Power", album: "Moon Pix", label: "Matador", formatId: 1 }, "Cat Power · Moon Pix · Matador · cd"],
    ["a format name wins over the id", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 2, format: "CD" }, "Juana Molina · DOGA · Sonamos · CD"],
    ["an empty label is dropped", { artist: "Stereolab", album: "Aluminum Tunes", label: "", formatId: 2 }, "Stereolab · Aluminum Tunes · vinyl"],
    ["an unknown format id is dropped", { artist: "Jessica Pratt", album: "On Your Own Love Again", label: "Drag City", formatId: 99 }, "Jessica Pratt · On Your Own Love Again · Drag City"],
  ])("%s", (_name, record, expected) => {
    expect(recordLine(record, formats)).toBe(expected);
  });

  it("maps an intake item through intakeRecord", () => {
    const item = { artist_name: "Cat Power", album_title: "Moon Pix", record_label: null, format_id: 1 } as IntakeItem;
    expect(recordLine(intakeRecord(item), formats)).toBe("Cat Power · Moon Pix · cd");
  });

  it("works without formats", () => {
    expect(recordLine({ artist: "Cat Power", album: "Moon Pix", label: "Matador", formatId: 1 })).toBe("Cat Power · Moon Pix · Matador");
  });
});
