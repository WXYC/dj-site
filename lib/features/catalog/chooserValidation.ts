/**
 * Client-side validation for the classic catalog chooser's two forms,
 * reproducing tubafrenzy's `library-code-form.js` (`artistSearchForm`) and
 * `validate-names.ts` (`newArtistForm`) rule-for-rule, including exact
 * message text.
 */

export type CallLetterMode = "textbox" | "compilation" | null;

export type ArtistSearchFormValues = {
  callLetterMode: CallLetterMode;
  artistLettersTextbox: string;
  rockCompLetters: string;
  genreId: number | null;
};

export type ArtistSearchValidationField =
  | "callLetterMode"
  | "artistLettersTextbox"
  | "rockCompLetters";

export type ValidationResult<Field extends string> =
  | { valid: true }
  | { valid: false; field: Field; message: string };

/**
 * The rockCompLetters sub-bucket letter is required for genreID 11 AND 12 —
 * the JSP's visible label names only "Rock comps", but its own validator
 * raises a distinct message for 12 ("Soundtracks require an additional
 * letter field."). Reproduced verbatim, incomplete label included.
 */
export function isRockCompLettersRequired(genreId: number | null): boolean {
  return genreId === 11 || genreId === 12;
}

export function validateArtistSearchForm(
  values: ArtistSearchFormValues,
): ValidationResult<ArtistSearchValidationField> {
  if (values.callLetterMode === "textbox") {
    if (values.artistLettersTextbox.trim() === "") {
      return {
        valid: false,
        field: "artistLettersTextbox",
        message: "You must enter artist letters.",
      };
    }
    return { valid: true };
  }

  if (values.callLetterMode === "compilation") {
    if (values.genreId === 11 && values.rockCompLetters.trim() === "") {
      return {
        valid: false,
        field: "rockCompLetters",
        message: "Rock compilations require an additional letter field.",
      };
    }
    if (values.genreId === 12 && values.rockCompLetters.trim() === "") {
      return {
        valid: false,
        field: "rockCompLetters",
        message: "Soundtracks require an additional letter field.",
      };
    }
    return { valid: true };
  }

  return {
    valid: false,
    field: "callLetterMode",
    message: "You must select one of the choices for Call Letters/Numbers.",
  };
}

export type NewArtistNamesField = "artistPresentationName" | "artistAlphabeticalName";

export function validateNewArtistNames(
  presentationName: string,
  alphabeticalName: string,
): ValidationResult<NewArtistNamesField> {
  if (presentationName.trim() === "") {
    return {
      valid: false,
      field: "artistPresentationName",
      message: "The presentation name cannot be empty.",
    };
  }
  if (alphabeticalName.trim() === "") {
    return {
      valid: false,
      field: "artistAlphabeticalName",
      message: "The alphabetical name cannot be empty.",
    };
  }
  return { valid: true };
}
