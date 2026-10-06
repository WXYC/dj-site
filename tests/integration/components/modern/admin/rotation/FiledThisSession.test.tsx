import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import type { LibraryFilingResponse } from "@wxyc/shared";
import { renderWithProviders } from "@/tests/helpers/render";
import FiledThisSession from "@/src/components/experiences/modern/admin/rotation/FiledThisSession";

const ROCK_GENRE_ID = 11;

function filing(
  artist: Pick<LibraryFilingResponse["artist"], "artist_name" | "code_letters" | "code_artist_number">,
  release: Pick<LibraryFilingResponse["release"], "id" | "album_title" | "code_number">,
  codeCompLetter?: string | null,
): LibraryFilingResponse {
  return {
    // The wire type predates `code_comp_letter`; the create arm answers null.
    artist: {
      id: 700,
      genre_id: ROCK_GENRE_ID,
      code_comp_letter: codeCompLetter,
      ...artist,
    } as LibraryFilingResponse["artist"],
    release: { artist_id: 700, genre_id: ROCK_GENRE_ID, format_id: 1, ...release },
  };
}

describe("FiledThisSession", () => {
  // The receipt's shelf code goes through the shared call-number formatter, so
  // a compilation filed at Backend-Service's `V/A` / 0 bucket reads as the
  // shelf spells it rather than as the nonexistent "V/A 0/<n>".
  it.each([
    [
      "a named artist",
      filing(
        { artist_name: "Stereolab", code_letters: "SL", code_artist_number: 1 },
        { id: 9001, album_title: "Aluminum Tunes", code_number: 3 },
      ),
      "SL 1/3",
    ],
    [
      "a Various Artists bucket",
      filing(
        { artist_name: "Various Artists - Rock - M", code_letters: "V/A", code_artist_number: 0 },
        { id: 9002, album_title: "Music for Plants", code_number: 121 },
      ),
      "V/A-121",
    ],
    [
      "a Rock bucket with a served section letter",
      filing(
        { artist_name: "Various Artists - Rock - M", code_letters: "V/A", code_artist_number: 0 },
        { id: 9003, album_title: "Music for Plants", code_number: 121 },
        "M",
      ),
      "V/A M-121",
    ],
  ])("renders %s's shelf code", (_name, filed, expected) => {
    renderWithProviders(<FiledThisSession filings={[filed]} />);

    expect(screen.getByText(new RegExp(`^${expected.replace("/", "\\/")} ·`))).toBeInTheDocument();
  });
});
