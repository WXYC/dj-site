import { describe, expect, it } from "vitest";
import type { IntakeItem } from "@wxyc/shared";
import { intakeRecord, recordLine } from "@/src/components/experiences/modern/reviews/recordLine";

const formats = [
  { id: 1, format_name: "cd" },
  { id: 2, format_name: "vinyl" },
  { id: 3, format_name: '7"' },
];

describe("recordLine", () => {
  it.each([
    ["a format id resolves to its name", { artist: "Cat Power", album: "Moon Pix", label: "Matador", formatId: 1 }, "Cat Power · Moon Pix · Matador · CD"],
    ["a format name wins over the id", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 2, format: "cd" }, "Juana Molina · DOGA · Sonamos · CD"],
    ["a vinyl format name reads Vinyl", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 1, format: "vinyl" }, "Juana Molina · DOGA · Sonamos · Vinyl"],
    ["any other format is unchanged", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 1, format: "cassette" }, "Juana Molina · DOGA · Sonamos · cassette"],
    ["a format name formatLabel does not tidy is unchanged", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 1, format: "cd box" }, "Juana Molina · DOGA · Sonamos · cd box"],
    ["a looked-up format name formatLabel does not tidy is unchanged", { artist: "Juana Molina", album: "DOGA", label: "Sonamos", formatId: 3 }, 'Juana Molina · DOGA · Sonamos · 7"'],
    ["an empty label is dropped", { artist: "Stereolab", album: "Aluminum Tunes", label: "", formatId: 2 }, "Stereolab · Aluminum Tunes · Vinyl"],
    ["an unknown format id is dropped", { artist: "Jessica Pratt", album: "On Your Own Love Again", label: "Drag City", formatId: 99 }, "Jessica Pratt · On Your Own Love Again · Drag City"],
  ])("%s", (_name, record, expected) => {
    expect(recordLine(record, formats)).toBe(expected);
  });

  it("maps an intake item through intakeRecord", () => {
    const item = { artist_name: "Cat Power", album_title: "Moon Pix", record_label: null, format_id: 1 } as IntakeItem;
    expect(recordLine(intakeRecord(item), formats)).toBe("Cat Power · Moon Pix · CD");
  });

  it("works without formats", () => {
    expect(recordLine({ artist: "Cat Power", album: "Moon Pix", label: "Matador", formatId: 1 })).toBe("Cat Power · Moon Pix · Matador");
  });
});
