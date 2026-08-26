import { describe, it, expect } from "vitest";
import {
  composeLibraryCodeSearchArgs,
  resolveArtistByCodeErrorReason,
} from "@/lib/features/catalog/libraryCodeResolution";

const ROCK_GENRE_ID = 11;

describe("composeLibraryCodeSearchArgs", () => {
  // Normalized at this edge like every other code-letters write path, so the
  // create-flow URL a miss redirects to carries the casing the catalog is
  // filed under rather than whatever the librarian typed.
  it("composes a textbox search from normalized letters and a parsed call number", () => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: "textbox",
        artistLettersTextbox: " mo ",
        artistNumbersTextbox: "12",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      ready: true,
      args: { genre_id: ROCK_GENRE_ID, code_letters: "MO", code_number: 12 },
    });
  });

  // 0 is a legitimate call number -- the Various Artists filing, and no
  // floor above 0 applies to an ordinary artist code either.
  it("accepts a call number of 0 in textbox mode", () => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: "textbox",
        artistLettersTextbox: "MO",
        artistNumbersTextbox: "0",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      ready: true,
      args: { genre_id: ROCK_GENRE_ID, code_letters: "MO", code_number: 0 },
    });
  });

  // The JSP's own client-side validator (library-code-form.js) never checks
  // artistNumbersTextbox at all -- a blank call number reached the servlet,
  // which forwarded the browser to a genre+letters-only browse
  // (LibraryCodeServlet -> multipleArtistsDisplay.jsp) with no floor on how
  // many numbers could come back. `by-code` requires a fully specified
  // triple and cannot browse by letters alone, so this is a forced
  // divergence: the form asks for the call number that JSP-parity validation
  // itself never required.
  it.each([[""], ["abc"], ["-1"]])(
    "refuses to compose a textbox search with an unparseable call number %j",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs({
          callLetterMode: "textbox",
          artistLettersTextbox: "MO",
          artistNumbersTextbox: raw,
          genreId: ROCK_GENRE_ID,
        }),
      ).toEqual({
        ready: false,
        message: "You must enter a call number to look up this code.",
      });
    },
  );

  // Every Various Artists bucket is filed at code_number 0 under the literal
  // code_letters "V/A", regardless of genre -- Backend-Service's catalog
  // import collapses the JSP's Rock/Soundtracks-only `Z-<letter>` sub-bucket
  // spelling to that one form (see libraryCode.ts's header), so the letter
  // the librarian enters into rockCompLetters cannot narrow this search; it
  // is validated for JSP parity but plays no part in the composed query.
  it("composes a compilation search as the fixed V/A, 0 pair for the selected genre", () => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: "compilation",
        artistLettersTextbox: "",
        artistNumbersTextbox: "",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      ready: true,
      args: { genre_id: ROCK_GENRE_ID, code_letters: "V/A", code_number: 0 },
    });
  });

  // Mirrors the endpoint's own `^[A-Za-z0-9/]{1,4}$` rule so a code it would
  // 400 on is named here instead of arriving as the caller's
  // unstructured-failure branch, which reads as "try again".
  it.each([["?!"], ["A-"], ["A B"], ["ABCDE"], [""], ["   "]])(
    "refuses call letters outside the code column's charset (%j)",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs({
          callLetterMode: "textbox",
          artistLettersTextbox: raw,
          artistNumbersTextbox: "12",
          genreId: ROCK_GENRE_ID,
        }),
      ).toEqual({ ready: false, message: "Call letters must be letters, digits, or a slash." });
    },
  );

  it.each([["MO"], ["V/A"], ["A1"], ["9"]])("composes an in-charset code (%j)", (raw) => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: "textbox",
        artistLettersTextbox: raw,
        artistNumbersTextbox: "12",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      ready: true,
      args: { genre_id: ROCK_GENRE_ID, code_letters: raw, code_number: 12 },
    });
  });

  it("refuses to compose without a resolved genre", () => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: "textbox",
        artistLettersTextbox: "MO",
        artistNumbersTextbox: "12",
        genreId: null,
      }),
    ).toEqual({ ready: false, message: "You must select a genre." });
  });

  it("refuses to compose with no call letter mode selected", () => {
    expect(
      composeLibraryCodeSearchArgs({
        callLetterMode: null,
        artistLettersTextbox: "",
        artistNumbersTextbox: "",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      ready: false,
      message: "You must select one of the choices for Call Letters/Numbers.",
    });
  });
});

describe("resolveArtistByCodeErrorReason", () => {
  it.each([["genre_not_found"], ["code_not_assigned"]] as const)(
    "reads the %s reason off a wrapped 404",
    (reason) => {
      expect(
        resolveArtistByCodeErrorReason({
          resolveArtistByCodeError: {
            status: 404,
            data: { message: "nope", reason },
          },
        }),
      ).toBe(reason);
    },
  );

  it("returns undefined for a 404 with no recognized reason", () => {
    expect(
      resolveArtistByCodeErrorReason({
        resolveArtistByCodeError: { status: 404, data: { message: "nope" } },
      }),
    ).toBeUndefined();
  });

  it.each([
    ["a 400 validation failure", { status: 400, data: { message: "bad genre_id" } }],
    ["a 500", { status: 500, data: { message: "boom" } }],
    ["a network failure", { status: "FETCH_ERROR", error: "Failed to fetch" }],
    ["a non-JSON body", { status: "PARSING_ERROR", originalStatus: 502, data: "<html>", error: "SyntaxError" }],
  ])("returns undefined for %s -- the caller's outage fallback, never an unassigned code", (_name, inner) => {
    expect(resolveArtistByCodeErrorReason({ resolveArtistByCodeError: inner })).toBeUndefined();
  });

  it("returns undefined for an error this endpoint didn't wrap", () => {
    expect(resolveArtistByCodeErrorReason({ status: 404, data: { reason: "code_not_assigned" } })).toBeUndefined();
    expect(resolveArtistByCodeErrorReason(undefined)).toBeUndefined();
    expect(resolveArtistByCodeErrorReason(null)).toBeUndefined();
  });
});
