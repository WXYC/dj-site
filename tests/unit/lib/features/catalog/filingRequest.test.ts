import { describe, it, expect } from "vitest";
import {
  buildLibraryFilingRequest,
  type FilingArtistInput,
  type LibraryFilingInput,
} from "@/lib/features/catalog/filingRequest";

const EXISTING_INPUT: LibraryFilingInput = {
  artist: { mode: "existing", artistId: 2001 },
  genreId: 6001,
  formatId: 1,
  albumTitle: "On Your Own Love Again",
  label: "Drag City",
  rotationBin: "H",
  cardId: 31,
  urls: ["jessicapratt.bandcamp.com"],
};

function createArtist(
  overrides: Partial<Extract<FilingArtistInput, { mode: "create" }>> = {},
): FilingArtistInput {
  return {
    mode: "create",
    artistName: "Chuquimamani-Condori",
    codeLetters: "CH",
    codeNumberRaw: "",
    alphabeticalName: "",
    ...overrides,
  };
}

const CREATE_INPUT: LibraryFilingInput = {
  artist: createArtist(),
  genreId: 6002,
  formatId: 2,
  albumTitle: "Edits",
  label: "",
  rotationBin: null,
  cardId: null,
  urls: [],
};

describe("buildLibraryFilingRequest", () => {
  it("sets kind: 'existing' explicitly from the typeahead pick", () => {
    expect(buildLibraryFilingRequest(EXISTING_INPUT)).toEqual({
      artist: { kind: "existing", artist_id: 2001 },
      release: {
        album_title: "On Your Own Love Again",
        genre_id: 6001,
        format_id: 1,
        label: "Drag City",
      },
      rotation: {
        rotation_bin: "H",
        card_id: 31,
        urls: ["jessicapratt.bandcamp.com"],
      },
    });
  });

  it("sets kind: 'create' explicitly and omits code_number for a clean draft", () => {
    // A clean field is the server's assignment to make; the request must not
    // carry a code_number the MD never chose.
    expect(buildLibraryFilingRequest(CREATE_INPUT).artist).toEqual({
      kind: "create",
      artist_name: "Chuquimamani-Condori",
      code_letters: "CH",
      genre_id: 6002,
    });
  });

  it("sends a dirty code-number draft as typed", () => {
    const request = buildLibraryFilingRequest({
      ...CREATE_INPUT,
      artist: createArtist({ codeNumberRaw: " 42 " }),
    });
    expect(request.artist).toMatchObject({ kind: "create", code_number: 42 });
  });

  it("sends a deliberate 0, the compilation bucket's own number", () => {
    const request = buildLibraryFilingRequest({
      ...CREATE_INPUT,
      artist: createArtist({ codeNumberRaw: "0" }),
    });
    expect(request.artist).toMatchObject({ kind: "create", code_number: 0 });
  });

  it("includes a trimmed alphabetical name only when one was typed", () => {
    const withName = buildLibraryFilingRequest({
      ...CREATE_INPUT,
      artist: createArtist({ alphabeticalName: " Chuquimamani-Condori, DJ " }),
    });
    expect(withName.artist).toMatchObject({
      alphabetical_name: "Chuquimamani-Condori, DJ",
    });
    expect(buildLibraryFilingRequest(CREATE_INPUT).artist).not.toHaveProperty(
      "alphabetical_name",
    );
  });

  it("omits rotation entirely for a library-only filing", () => {
    const request = buildLibraryFilingRequest({ ...EXISTING_INPUT, rotationBin: null });
    expect(request).not.toHaveProperty("rotation");
  });

  it("omits card_id and urls the form did not fill", () => {
    const request = buildLibraryFilingRequest({
      ...EXISTING_INPUT,
      cardId: null,
      urls: [],
    });
    expect(request.rotation).toEqual({ rotation_bin: "H" });
  });

  it("omits an empty label rather than filing an empty string", () => {
    const request = buildLibraryFilingRequest({ ...EXISTING_INPUT, label: "  " });
    expect(request.release).not.toHaveProperty("label");
  });
});
