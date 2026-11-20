import { describe, it, expect } from "vitest";
import { groupBinByShelf, sortBinByShelf } from "@/lib/features/bin/shelfOrder";
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";

describe("sortBinByShelf", () => {
  const album = (
    artist: string,
    genre: string,
    format: string,
    { title = "Untitled", lettercode = "XX" } = {},
  ) =>
    createTestAlbum({
      title,
      format,
      artist: createTestArtist({ name: artist, genre, lettercode }),
    });
  const compilation = (genre: string, format: string, name = "Various Artists") =>
    album(name, genre, format, { lettercode: "V/A" });

  const describeOrder = (entries: ReturnType<typeof album>[]) =>
    sortBinByShelf(entries).map(
      (e) => `${e.artist.genre} ${e.format}: ${e.artist.name}`,
    );

  it("walks the shelves in the station's order", () => {
    const shelves: [string, string][] = [
      ["Rock", "Vinyl"],
      ["Reggae", "Vinyl"],
      ["Blues", "Vinyl"],
      ["OCS", "Vinyl"],
      ["Latin", "Vinyl"],
      ["Africa", "Vinyl"],
      ["Asia", "Vinyl"],
      ["Reggae", "CD"],
      ["Rock", "CD"],
      ["Classical", "Vinyl"],
      ["Jazz", "Vinyl"],
      ["Xmas", "Vinyl"],
      ["Comedy", "Vinyl"],
      ["Blues", "CD"],
      ["Soundtracks", "CD"],
      ["Electronic", "Vinyl"],
      ["Hiphop", "Vinyl"],
      ["Spoken", "Vinyl"],
      ["Soundtracks", "Vinyl"],
      ["Classical", "CD"],
      ["Jazz", "CD"],
      ["Xmas", "CD"],
      ["Electronic", "CD"],
      ["OCS", "CD"],
      ["Spoken", "CD"],
      ["Hiphop", "CD"],
      ["Asia", "CD"],
      ["Africa", "CD"],
      ["Latin", "CD"],
      ["Rock", "Cassette"],
    ];
    const expected = shelves.map(([genre, format]) => `${genre} ${format}: Stereolab`);
    const entries = shelves.map(([genre, format]) => album("Stereolab", genre, format));

    expect(describeOrder([...entries].reverse())).toEqual(expected);
  });

  it("puts Rock CD compilations ahead of the named Rock CD artists", () => {
    expect(
      describeOrder([
        album("Cat Power", "Rock", "CD"),
        compilation("Rock", "CD", "Various Artists - Rock - M"),
        album("Juana Molina", "Rock", "Vinyl"),
        compilation("Rock", "CD", "Various Artists - Rock - B"),
      ]),
    ).toEqual([
      "Rock Vinyl: Juana Molina",
      "Rock CD: Various Artists - Rock - B",
      "Rock CD: Various Artists - Rock - M",
      "Rock CD: Cat Power",
    ]);
  });

  it("orders artists alphabetically within a shelf with compilations last", () => {
    expect(
      describeOrder([
        album("Stereolab", "Rock", "Vinyl"),
        compilation("Rock", "Vinyl"),
        album("jessica Pratt", "Rock", "Vinyl"),
        album("Juana Molina", "Rock", "Vinyl"),
        compilation("Jazz", "CD"),
        album("Duke Ellington & John Coltrane", "Jazz", "CD"),
      ]),
    ).toEqual([
      "Rock Vinyl: jessica Pratt",
      "Rock Vinyl: Juana Molina",
      "Rock Vinyl: Stereolab",
      "Rock Vinyl: Various Artists",
      "Jazz CD: Duke Ellington & John Coltrane",
      "Jazz CD: Various Artists",
    ]);
  });

  it("files format variants with their kind", () => {
    expect(
      describeOrder([
        album("Stereolab", "Reggae", "CD-R"),
        album("Juana Molina", "Rock", '12" Vinyl'),
      ]),
    ).toEqual(['Rock 12" Vinyl: Juana Molina', "Reggae CD-R: Stereolab"]);
  });

  it("sends unlisted shelves to the end, grouped by genre then format", () => {
    expect(
      describeOrder([
        album("Stereolab", "Soundtracks", "Unknown"),
        album("Cat Power", "Rock", "Cassette"),
        compilation("Jazz", "Cassette"),
        album("Juana Molina", "Jazz", "Cassette"),
        album("Chuquimamani-Condori", "Latin", "CD"),
        album("Jessica Pratt", "Rock", "Minidisc"),
      ]),
    ).toEqual([
      "Latin CD: Chuquimamani-Condori",
      "Jazz Cassette: Juana Molina",
      "Jazz Cassette: Various Artists",
      "Rock Cassette: Cat Power",
      "Rock Minidisc: Jessica Pratt",
      "Soundtracks Unknown: Stereolab",
    ]);
  });

  it("breaks an artist tie by album title and leaves the input untouched", () => {
    const input = [
      album("Stereolab", "Rock", "CD", { title: "Emperor Tomato Ketchup" }),
      album("Stereolab", "Rock", "CD", { title: "Dots and Loops" }),
    ];

    expect(sortBinByShelf(input).map((e) => e.title)).toEqual([
      "Dots and Loops",
      "Emperor Tomato Ketchup",
    ]);
    expect(input[0].title).toBe("Emperor Tomato Ketchup");
  });
});

describe("groupBinByShelf", () => {
  const album = (name: string, genre: string, format: string, lettercode = "XX") =>
    createTestAlbum({ format, artist: createTestArtist({ name, genre, lettercode }) });

  const shelves = (entries: ReturnType<typeof album>[]) =>
    groupBinByShelf(entries).map(
      ({ shelf, entries }) => `${shelf}: ${entries.map((e) => e.artist.name).join(", ")}`,
    );

  it("names a listed shelf by its genre and vinyl or CD, whatever the format's spelling", () => {
    expect(
      shelves([
        album("Stereolab", "Jazz", "cdr"),
        album("Juana Molina", "Rock", 'vinyl 12"'),
        album("Cat Power", "Rock", "vinyl"),
      ]),
    ).toEqual(["Rock vinyl: Cat Power, Juana Molina", "Jazz CD: Stereolab"]);
  });

  it("gives Rock compilations their own headings, after vinyl and ahead of CD", () => {
    expect(
      shelves([
        album("Cat Power", "Rock", "cd"),
        album("Various Artists - Rock - N", "Rock", "cd", "V/A"),
        album("Various Artists", "Rock", "vinyl", "V/A"),
        album("Juana Molina", "Rock", "vinyl"),
        album("Various Artists", "Jazz", "cd", "V/A"),
        album("Stereolab", "Jazz", "cd"),
      ]),
    ).toEqual([
      "Rock vinyl: Juana Molina",
      "Rock vinyl V/A: Various Artists",
      "Rock CD V/A: Various Artists - Rock - N",
      "Rock CD: Cat Power",
      "Jazz CD: Stereolab, Various Artists",
    ]);
  });

  it("names an unlisted shelf by the genre and format as filed", () => {
    expect(
      shelves([
        album("Juana Molina", "Rock", "cassette"),
        album("Stereolab", "Rock", ""),
      ]),
    ).toEqual(["Rock Unknown: Stereolab", "Rock cassette: Juana Molina"]);
  });
});
