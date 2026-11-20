import { describe, it, expect } from "vitest";
import {
  formatBinForExport,
  callNumberFor,
} from "@/lib/features/bin/export";
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
  it("emits a TSV header, then each shelf's heading row above its albums", () => {
    const { tsv } = formatBinForExport([pratt, stereolab]);

    expect(tsv.split("\n")).toEqual([
      "Call #\tArtist\tAlbum\tFormat",
      "== Rock vinyl ==",
      "JM 12/3\tJuana Molina\tDOGA\tVinyl",
      "== Rock CD ==",
      "PR 4/1\tJessica Pratt\tOn Your Own Love Again\tCD",
    ]);
  });

  it("emits a table with a full-width heading row per shelf and no label", () => {
    const { html } = formatBinForExport([stereolab]);

    expect(html).toBe(
      "<table><thead><tr><th>Call #</th><th>Artist</th><th>Album</th><th>Format</th></tr></thead>" +
        '<tbody><tr><th colspan="4">== Rock vinyl ==</th></tr>' +
        "<tr><td>JM 12/3</td><td>Juana Molina</td><td>DOGA</td><td>Vinyl</td></tr></tbody></table>",
    );
  });

  it("names a Various Artists bucket plainly but keeps other names, leaving the entry untouched", () => {
    const compilation = (name: string, lettercode = "V/A") =>
      createTestAlbum({
        title: "Nuggets",
        format: "CD",
        entry: 16,
        artist: createTestArtist({ name, genre: "Rock", lettercode, numbercode: 0 }),
      });
    const rockBucket = compilation("Various Artists - Rock - N");

    const { shareText } = formatBinForExport([
      rockBucket,
      compilation("Soundtracks - M"),
      compilation("Various Artists - The Band", "VA"),
    ]);

    const artists = shareText
      .split("\n")
      .filter((line) => line.startsWith("["))
      .map((line) => line.replace(/^\[[^\]]*\] /, "").split(" — ")[0]);
    expect(artists).toEqual([
      "Soundtracks - M",
      "Various Artists",
      "Various Artists - The Band",
    ]);
    expect(rockBucket.artist.name).toBe("Various Artists - Rock - N");
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

  it("builds share text with a blank line and heading before each shelf", () => {
    const { shareText } = formatBinForExport([pratt, stereolab]);

    expect(shareText.split("\n")).toEqual([
      "WXYC Mail Bin",
      "",
      "== Rock vinyl ==",
      "[JM 12/3] Juana Molina — DOGA",
      "",
      "== Rock CD ==",
      "[PR 4/1] Jessica Pratt — On Your Own Love Again",
    ]);
  });

  it("exports rows in shelf order", () => {
    const { tsv } = formatBinForExport([
      createTestAlbum({ format: "CD", artist: createTestArtist({ name: "Stereolab", genre: "Rock" }) }),
      createTestAlbum({ format: "Vinyl", artist: createTestArtist({ name: "Juana Molina", genre: "Reggae" }) }),
    ]);

    const albumRows = tsv.split("\n").slice(1).filter((l) => l.includes("\t"));
    expect(albumRows.map((l) => l.split("\t")[1])).toEqual([
      "Juana Molina",
      "Stereolab",
    ]);
  });
});

describe("callNumberFor", () => {
  it("formats lettercode, numbercode and entry as `LL N/E`", () => {
    expect(callNumberFor(stereolab)).toBe("JM 12/3");
  });

  // Backend-Service stores every compilation as code_letters = "V/A" with
  // code_artist_number = 0, so a naive join of the two parts renders the
  // nonexistent shelf code "V/A 0/1" instead of the real "V/A-1".
  it("renders a Various Artists bucket as V/A-<entry>, dropping the 0 artist number", () => {
    const compilation = createTestAlbum({
      title: "WXYC Benefit Compilation",
      artist: createTestArtist({
        name: "Various Artists",
        lettercode: "V/A",
        numbercode: 0,
      }),
      entry: 1,
      label: "self-released",
      format: "CD",
    });

    expect(callNumberFor(compilation)).toBe("V/A-1");
  });
});

describe("callNumberFor with a lettered compilation", () => {
  const compilation = (genre_id: number, code_comp_letter: string, code_volume_letters?: string | null) =>
    createTestAlbum({
      entry: 7,
      code_volume_letters,
      artist: createTestArtist({
        lettercode: "V/A",
        numbercode: 3,
        genre_id,
        code_comp_letter,
      }),
    });

  it.each([
    ["Rock prints V/A <L>-<n>", compilation(11, "b"), "V/A B-7"],
    ["Soundtracks prints <L>-<n>", compilation(12, "c"), "C-7"],
    [
      "a volume letter is the trimmed, upper-cased suffix",
      compilation(11, "b", " d "),
      "V/A B-7-D",
    ],
  ])("%s", (_name, album, expected) => {
    expect(callNumberFor(album)).toBe(expected);
  });
});

