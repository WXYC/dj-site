import { describe, it, expect } from "vitest";
import { formatBinForExport, callNumberFor } from "./export";
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";

const stereolab = createTestAlbum({
  title: "DOGA",
  artist: createTestArtist({
    name: "Juana Molina",
    lettercode: "JM",
    numbercode: 12,
  }),
  entry: 3,
  label: "Sonamos",
  format: "Vinyl",
});

const pratt = createTestAlbum({
  title: "On Your Own Love Again",
  artist: createTestArtist({
    name: "Jessica Pratt",
    lettercode: "PR",
    numbercode: 4,
  }),
  entry: 1,
  label: "Drag City",
  format: "CD",
});

describe("formatBinForExport", () => {
  it("emits a TSV header plus one tab-separated row per album", () => {
    const { tsv } = formatBinForExport([stereolab, pratt]);

    const lines = tsv.split("\n");
    expect(lines[0]).toBe("Call #\tAlbum\tArtist\tLabel\tFormat");
    expect(lines[1]).toBe("JM 12/3\tDOGA\tJuana Molina\tSonamos\tVinyl");
    expect(lines[2]).toBe(
      "PR 4/1\tOn Your Own Love Again\tJessica Pratt\tDrag City\tCD",
    );
  });

  it("emits a table whose rows carry each album's cells", () => {
    const { html } = formatBinForExport([stereolab]);

    expect(html).toContain("<table>");
    expect(html).toContain("<th>Call #</th>");
    expect(html).toContain(
      "<td>JM 12/3</td><td>DOGA</td><td>Juana Molina</td><td>Sonamos</td><td>Vinyl</td>",
    );
  });

  it("escapes HTML-special characters in cell values", () => {
    const risky = createTestAlbum({
      title: "Rock & <Roll>",
      artist: createTestArtist({ name: "A & B" }),
    });

    const { html } = formatBinForExport([risky]);

    expect(html).toContain("<td>Rock &amp; &lt;Roll&gt;</td>");
    expect(html).not.toContain("<Roll>");
  });

  it("builds readable share lines with the call number and label", () => {
    const { shareText } = formatBinForExport([stereolab, pratt]);

    const lines = shareText.split("\n");
    expect(lines[0]).toBe("WXYC Mail Bin");
    expect(lines[2]).toBe("[JM 12/3] DOGA — Juana Molina (Sonamos)");
    expect(lines[3]).toBe(
      "[PR 4/1] On Your Own Love Again — Jessica Pratt (Drag City)",
    );
  });

  it("omits the parenthetical when an album has no label", () => {
    const noLabel = createTestAlbum({
      title: "Untitled",
      artist: createTestArtist({
        name: "Unknown",
        lettercode: "UN",
        numbercode: 1,
      }),
      entry: 5,
      label: "",
    });

    const { shareText } = formatBinForExport([noLabel]);

    expect(shareText.split("\n")[2]).toBe("[UN 1/5] Untitled — Unknown");
  });
});

describe("callNumberFor", () => {
  it("formats lettercode, numbercode and entry as `LL N/E`", () => {
    expect(callNumberFor(stereolab)).toBe("JM 12/3");
  });
});
