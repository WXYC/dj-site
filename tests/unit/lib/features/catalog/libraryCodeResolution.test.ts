import { describe, it, expect } from "vitest";
import {
  composeLibraryCodeSearchArgs,
  resolveArtistByCodeErrorReason,
} from "@/lib/features/catalog/libraryCodeResolution";
import { VARIOUS_ARTISTS_CODE_NUMBER } from "@/lib/features/catalog/libraryCode";

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
  // which fell through to a genre+letters browse (LibraryCodeServlet ->
  // multipleArtistsDisplay.jsp). `by-code` answers that browse when
  // `code_number` is ABSENT, so a blank field composes a two-key query
  // rather than being refused.
  it.each([[""], ["  "]])(
    "composes a genre + call-letters browse when the call number is blank (%j)",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs(
          {
            callLetterMode: "textbox",
            artistLettersTextbox: " mo ",
            artistNumbersTextbox: raw,
            genreId: ROCK_GENRE_ID,
          },
          { allowBucketBrowse: true },
        ),
      ).toEqual({
        ready: true,
        args: { genre_id: ROCK_GENRE_ID, code_letters: "MO" },
      });
    },
  );

  // The browse is opt-in and the default refuses, because this gate is shared
  // with the move screen -- where a blank field would otherwise offer every
  // artist in the section as somewhere to write a release to. A caller that
  // has no screen for a whole bucket gets the refusal it had before.
  it.each([[""], ["  "]])(
    "refuses a blank call number for a caller that did not ask to browse (%j)",
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
        reason: "call_number_required",
        message: "You must enter a call number to look up this code.",
      });
    },
  );

  // The hint would be a lie on a screen that refuses a blank field: told to
  // leave it blank, the librarian is then refused for leaving it blank.
  it("names the blank-field alternative only where leaving it blank works", () => {
    const values = {
      callLetterMode: "textbox" as const,
      artistLettersTextbox: "MO",
      artistNumbersTextbox: "4x",
      genreId: ROCK_GENRE_ID,
    };

    expect(composeLibraryCodeSearchArgs(values)).toMatchObject({
      reason: "call_number_malformed",
      message: "Call numbers must be a whole number.",
    });
    expect(composeLibraryCodeSearchArgs(values, { allowBucketBrowse: true })).toMatchObject({
      reason: "call_number_malformed",
      message:
        "Call numbers must be a whole number. Leave it blank to list every artist under these call letters.",
    });
  });

  // Absent, never present-and-empty: the endpoint reads `code_number=` as a
  // client bug and 400s it, because `Number('')` is 0 and 0 is a legitimate
  // V/A filing. `fetchBaseQuery` strips an undefined param, so the key simply
  // must not carry a value -- `code_number: ""` would be sent verbatim.
  it("omits code_number entirely from a browse rather than sending an empty one", () => {
    const composed = composeLibraryCodeSearchArgs(
      {
        callLetterMode: "textbox",
        artistLettersTextbox: "MO",
        artistNumbersTextbox: "",
        genreId: ROCK_GENRE_ID,
      },
      { allowBucketBrowse: true },
    );

    expect(composed.ready).toBe(true);
    if (!composed.ready) return;
    expect(composed.args.code_number).toBeUndefined();
  });

  // Only a BLANK number browses. A malformed one is still a refusal, and it
  // is a different refusal than it used to be: the old `call_number_required`
  // named a rule that no longer exists. Keeping that token would merge the
  // blank population (now the browse) with the typo population across the
  // deploy, which is the one thing a stable token exists to prevent.
  it.each([["abc"], ["-1"], ["1.5"], ["1 2"]])(
    "refuses a malformed call number rather than browsing on it (%j)",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs(
          {
            callLetterMode: "textbox",
            artistLettersTextbox: "MO",
            artistNumbersTextbox: raw,
            genreId: ROCK_GENRE_ID,
          },
          { allowBucketBrowse: true },
        ),
      ).toEqual({
        ready: false,
        reason: "call_number_malformed",
        message:
          "Call numbers must be a whole number. Leave it blank to list every artist under these call letters.",
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
  it.each([["?!"], ["A-"], ["A B"], [""], ["   "]])(
    "refuses call letters outside the code column's charset (%j)",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs({
          callLetterMode: "textbox",
          artistLettersTextbox: raw,
          artistNumbersTextbox: "12",
          genreId: ROCK_GENRE_ID,
        }),
      ).toEqual({
        ready: false,
        reason: "call_letters_charset",
        message: "Call letters must be letters, digits, or a slash.",
      });
    },
  );

  // Length is refused separately from charset, and "ABCDE" is why: every
  // character in it is legal, so answering with the charset sentence describes
  // none of what the librarian typed. They retype the same five characters and
  // are refused again, with the four-character ceiling never stated — visible
  // but not actionable. `isCanonicalCodeLetters` cannot make the distinction on
  // its own: it is one boolean over a `{1,4}` regex, so the length check has to
  // run first and carry its own `reason`.
  it.each([["ABCDE"], ["ABCDEFGH"], ["A/B/C/D/E"]])(
    "refuses an over-length call-letters code by NAMING the length, not the charset (%j)",
    (raw) => {
      expect(
        composeLibraryCodeSearchArgs({
          callLetterMode: "textbox",
          artistLettersTextbox: raw,
          artistNumbersTextbox: "12",
          genreId: ROCK_GENRE_ID,
        }),
      ).toEqual({
        ready: false,
        reason: "call_letters_too_long",
        message: "Call letters must be at most 4 characters.",
      });
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
    ).toEqual({ ready: false, reason: "genre_required", message: "You must select a genre." });
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
      reason: "call_letter_mode_required",
      message: "You must select one of the choices for Call Letters/Numbers.",
    });
  });
});

describe("composeLibraryCodeSearchArgs refusal reasons", () => {
  // The refusal reason is the machine-readable half of a refusal, reported to
  // telemetry where the human message cannot be: reading UI copy as a
  // dimension breaks the moment the copy is reworded.
  it("distinguishes a malformed call number from unusable call letters", () => {
    const base = { callLetterMode: "textbox" as const, genreId: ROCK_GENRE_ID };

    const badNumber = composeLibraryCodeSearchArgs({
      ...base,
      artistLettersTextbox: "ME",
      artistNumbersTextbox: "4x",
    });
    const badLetters = composeLibraryCodeSearchArgs({
      ...base,
      artistLettersTextbox: "?!",
      artistNumbersTextbox: "47",
    });

    expect(badNumber).toMatchObject({ ready: false, reason: "call_number_malformed" });
    expect(badLetters).toMatchObject({ ready: false, reason: "call_letters_charset" });
  });

  // The letters gates run BEFORE the number is read, so a submit that is wrong
  // in both places is reported against the letters. That ordering is what
  // keeps a blank number from turning an unusable code into a browse request
  // the endpoint would 400 on.
  it("refuses unusable call letters ahead of browsing on a blank number", () => {
    expect(
      composeLibraryCodeSearchArgs(
        {
          callLetterMode: "textbox",
          artistLettersTextbox: "?!",
          artistNumbersTextbox: "",
          genreId: ROCK_GENRE_ID,
        },
        { allowBucketBrowse: true },
      ),
    ).toMatchObject({ ready: false, reason: "call_letters_charset" });
  });

  // Compilation mode composes its call number rather than reading one, so
  // neither the call-number refusal nor the browse is reachable from that
  // radio -- the asymmetry a reported failure on this screen has to be read
  // against. A blank number there stays the fully-specified V/A lookup.
  it("never refuses a compilation search for a missing call number, and never browses on one", () => {
    expect(
      composeLibraryCodeSearchArgs(
        {
          callLetterMode: "compilation",
          artistLettersTextbox: "",
          artistNumbersTextbox: "",
          genreId: ROCK_GENRE_ID,
        },
        { allowBucketBrowse: true },
      ),
    ).toMatchObject({
      ready: true,
      args: { code_letters: "V/A", code_number: VARIOUS_ARTISTS_CODE_NUMBER },
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
