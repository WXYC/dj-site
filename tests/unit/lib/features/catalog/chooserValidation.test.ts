import { describe, it, expect } from "vitest";
import {
  isRockCompLettersRequired,
  validateArtistSearchForm,
  validateNewArtistNames,
} from "@/lib/features/catalog/chooserValidation";

// Genre 11 (Rock) and 12 (Soundtracks) are the two genres tubafrenzy's
// library-code-form.js requires an extra V/A call letter for, even though the
// JSP's own visible label only names Rock comps.
const ROCK_GENRE_ID = 11;
const SOUNDTRACKS_GENRE_ID = 12;
const OTHER_GENRE_ID = 3;

describe("validateArtistSearchForm", () => {
  it("requires a callLetterMode selection", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: null,
        artistLettersTextbox: "",
        rockCompLetters: "",
        genreId: null,
      }),
    ).toEqual({
      valid: false,
      field: "callLetterMode",
      message: "You must select one of the choices for Call Letters/Numbers.",
    });
  });

  it("requires artist letters in textbox mode", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "textbox",
        artistLettersTextbox: "  ",
        rockCompLetters: "",
        genreId: null,
      }),
    ).toEqual({
      valid: false,
      field: "artistLettersTextbox",
      message: "You must enter artist letters.",
    });
  });

  it("passes textbox mode once artist letters are present", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "textbox",
        artistLettersTextbox: "MO",
        rockCompLetters: "",
        genreId: null,
      }),
    ).toEqual({ valid: true });
  });

  it("passes compilation mode for a genre that isn't Rock or Soundtracks", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "compilation",
        artistLettersTextbox: "",
        rockCompLetters: "",
        genreId: OTHER_GENRE_ID,
      }),
    ).toEqual({ valid: true });
  });

  it("requires the rockCompLetters sub-bucket letter for genreID 11 (Rock)", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "compilation",
        artistLettersTextbox: "",
        rockCompLetters: "",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({
      valid: false,
      field: "rockCompLetters",
      message: "Rock compilations require an additional letter field.",
    });
  });

  it("requires the rockCompLetters sub-bucket letter for genreID 12 (Soundtracks) with its own message", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "compilation",
        artistLettersTextbox: "",
        rockCompLetters: "",
        genreId: SOUNDTRACKS_GENRE_ID,
      }),
    ).toEqual({
      valid: false,
      field: "rockCompLetters",
      message: "Soundtracks require an additional letter field.",
    });
  });

  it("passes compilation mode for genre 11 once rockCompLetters is filled", () => {
    expect(
      validateArtistSearchForm({
        callLetterMode: "compilation",
        artistLettersTextbox: "",
        rockCompLetters: "R",
        genreId: ROCK_GENRE_ID,
      }),
    ).toEqual({ valid: true });
  });
});

describe("isRockCompLettersRequired", () => {
  it("is true for genreID 11 and 12, false otherwise", () => {
    expect(isRockCompLettersRequired(ROCK_GENRE_ID)).toBe(true);
    expect(isRockCompLettersRequired(SOUNDTRACKS_GENRE_ID)).toBe(true);
    expect(isRockCompLettersRequired(OTHER_GENRE_ID)).toBe(false);
    expect(isRockCompLettersRequired(null)).toBe(false);
  });
});

describe("validateNewArtistNames", () => {
  it("requires a non-empty presentation name", () => {
    expect(validateNewArtistNames("  ", "Molina, Juana")).toEqual({
      valid: false,
      field: "artistPresentationName",
      message: "The presentation name cannot be empty.",
    });
  });

  it("requires a non-empty alphabetical name", () => {
    expect(validateNewArtistNames("Juana Molina", "  ")).toEqual({
      valid: false,
      field: "artistAlphabeticalName",
      message: "The alphabetical name cannot be empty.",
    });
  });

  it("passes when both names are present", () => {
    expect(validateNewArtistNames("Juana Molina", "Molina, Juana")).toEqual({
      valid: true,
    });
  });
});
