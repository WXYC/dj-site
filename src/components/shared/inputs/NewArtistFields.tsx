"use client";

import { useLayoutEffect, useRef } from "react";
import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
  Typography,
} from "@mui/joy";

import {
  isArtistNameConflictData,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type { AddArtistConflict } from "@/lib/features/catalog/types";
// Layering note: this shared field group reaches into the modern experience for
// the code preview. Converting the two classic artist forms onto this group
// would have to move CallLetterPeekControl alongside it.
import CallLetterPeekControl from "@/src/components/experiences/modern/catalog/CallLetterPeekControl";

/**
 * Column ceilings on the rows an artist-creation form writes. Nothing between
 * these fields and the INSERT checks any of them — the handler validates only
 * that the keys are present — so an over-long or over-large value reaches
 * PostgreSQL and comes back as a 22001/22003 500 rather than a validation
 * error. Each ceiling has to hold here, and be visible to the MD rather than
 * failing at the far end of a submit.
 *
 * `artists.code_letters` is a `varchar(4)`; `artists.artist_name` and
 * `artists.alphabetical_name` are `varchar(128)`; the code number is filed as
 * `genre_artist_crossreference.artist_genre_code`, a PostgreSQL `integer`
 * whose range check fires at bind time, before the insert.
 */
export const CODE_LETTERS_MAX_LENGTH = 4;
export const ARTIST_NAME_MAX_LENGTH = 128;
export const CODE_NUMBER_MAX = 2147483647;

/**
 * Call letters are matched case-sensitively everywhere the backend uses them —
 * the duplicate pre-check and the next-code-number scan both compare the
 * column for equality, over a plain btree on a non-citext column — and the
 * existing card catalog is filed uppercase. Lowercase "mo" therefore matches
 * no row of the "MO" series: it slips past the duplicate check and previews a
 * next code of 1, opening a second series that shadows the real one while the
 * form reports success. Normalizing at the edge keeps the field, the code
 * preview, and the request body on the one casing the catalog actually uses.
 *
 * Case is the only thing normalized. The catalog files live codes that are not
 * plain letters — "V/A" for Various Artists compilations, "??" placeholders,
 * and codes carrying digits — so narrowing this field to A-Z would make those
 * releases impossible to file. The permissiveness is load-bearing.
 */
export function normalizeCodeLetters(value: string): string {
  return value.toUpperCase();
}

/**
 * Value and caret travel together because normalizing on every keystroke makes
 * them inseparable. Writing the uppercased text back into a controlled input
 * replaces `node.value`, and the HTML value setter drops the caret at the end
 * of the field; React only restores a selection across a commit when focus
 * moved, which it has not here. Left alone, an MD correcting a character
 * mid-code has the caret jump silently after the first lowercase keystroke, so
 * the next one lands at the end and files a different — but still
 * valid-looking — four-character code with nothing reported wrong. Codes are
 * written onto the physical cards, so a wrong-but-valid one is the expensive
 * outcome.
 *
 * Pairing them is also what guarantees the render the caret replacement hangs
 * off: an edit that only changed case normalizes back to the string already
 * held, and a state write of an equal value would be skipped entirely, leaving
 * the DOM node holding the un-normalized text the browser put there. Do not
 * split these into two states — separately, each write can bail out.
 */
export type CodeLettersField = {
  value: string;
  caret: number | null;
};

export type NewArtistFieldValues = {
  alphabeticalName: string;
  codeLetters: string;
  codeNumberRaw: string;
};

export type NewArtistFieldValidation = {
  trimmedAlphabeticalName: string;
  trimmedCodeLetters: string;
  alphabeticalNameTooLong: boolean;
  codeLettersTooLong: boolean;
  /** Rejected as a positive whole number, before any range check. */
  parsedCodeNumber: number | null;
  /** Parsed *and* within the column's range, or null. */
  codeNumber: number | null;
  codeNumberInvalid: boolean;
};

/**
 * Derives everything both the fields and their form's submit gate need to know.
 * Pure, so a caller computing it for `canSubmit` and this component computing it
 * for display are reading one rule rather than keeping two in step.
 */
export function validateNewArtistFields(
  values: NewArtistFieldValues,
): NewArtistFieldValidation {
  const trimmedAlphabeticalName = values.alphabeticalName.trim();
  const trimmedCodeLetters = values.codeLetters.trim();
  const parsedCodeNumber = parseRequiredPositiveInt(values.codeNumberRaw);
  // parseRequiredPositiveInt only rejects non-integers; the column's range is
  // this form's to enforce.
  const codeNumber =
    parsedCodeNumber !== null && parsedCodeNumber <= CODE_NUMBER_MAX
      ? parsedCodeNumber
      : null;

  return {
    trimmedAlphabeticalName,
    trimmedCodeLetters,
    alphabeticalNameTooLong:
      trimmedAlphabeticalName.length > ARTIST_NAME_MAX_LENGTH,
    codeLettersTooLong: trimmedCodeLetters.length > CODE_LETTERS_MAX_LENGTH,
    parsedCodeNumber,
    codeNumber,
    codeNumberInvalid:
      values.codeNumberRaw.trim().length > 0 && codeNumber === null,
  };
}

/**
 * A 409 the server sent, snapshotted with the values it actually rejected.
 * Read the snapshot rather than the live fields: an MD editing any of them
 * after the rejection would otherwise have the banner keep reporting the new,
 * unsubmitted value as taken.
 *
 * `response` is null when the 409 named no artist the banner could render — an
 * intermediary's own JSON, or a shape the form cannot read.
 */
export type NewArtistConflict = {
  code_letters: string;
  code_number: string;
  name: string;
  response: AddArtistConflict | null;
};

export type NewArtistFieldsProps = {
  values: NewArtistFieldValues;
  /**
   * Held by the caller so one owner keeps the value and its caret together —
   * see CodeLettersField.
   */
  codeLettersField: CodeLettersField;
  onCodeLettersFieldChange: (next: CodeLettersField) => void;
  onCodeNumberChange: (value: string) => void;
  onAlphabeticalNameChange: (value: string) => void;
  genreId: number | null;
  disabled: boolean;
  conflict: NewArtistConflict | null;
};

/**
 * The field group an MD fills in to file an artist that does not exist yet:
 * alphabetical name, call letters, code number, the next-code preview, and the
 * conflict banner for a 409 on any of them.
 *
 * Fully controlled and free of any mutation — the artist name lives with
 * whatever typeahead decided this artist is new, which is outside this group,
 * and so does the submit.
 */
export function NewArtistFields({
  values,
  codeLettersField,
  onCodeLettersFieldChange,
  onCodeNumberChange,
  onAlphabeticalNameChange,
  genreId,
  disabled,
  conflict,
}: NewArtistFieldsProps) {
  const codeLettersInputRef = useRef<HTMLInputElement | null>(null);
  const {
    alphabeticalNameTooLong,
    codeLettersTooLong,
    codeNumberInvalid,
    parsedCodeNumber,
  } = validateNewArtistFields(values);

  // Puts the caret back where the edit left it. React writes the normalized
  // value into the node during the commit's mutation phase, which is the write
  // that moves the caret, so the replacement has to run after that — a layout
  // effect, not an effect, or the field paints for a frame with the caret at
  // the wrong end.
  useLayoutEffect(() => {
    const input = codeLettersInputRef.current;
    const { caret } = codeLettersField;
    if (caret === null || input === null) return;
    input.setSelectionRange(caret, caret);
  }, [codeLettersField]);

  const handleCodeLettersChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const raw = input.value;
    const caret = input.selectionStart;
    onCodeLettersFieldChange({
      value: normalizeCodeLetters(raw),
      // Uppercasing can lengthen the text before the caret ("ß" becomes "SS"),
      // so the caret's new home is the length of the normalized prefix, not
      // the index the browser reported against the raw text.
      caret:
        caret === null ? null : normalizeCodeLetters(raw.slice(0, caret)).length,
    });
  };

  return (
    <Stack spacing={1.5}>
      <FormControl error={alphabeticalNameTooLong}>
        <FormLabel>Alphabetical name (optional)</FormLabel>
        <Input
          value={values.alphabeticalName}
          disabled={disabled}
          onChange={(e) => onAlphabeticalNameChange(e.target.value)}
          placeholder="Defaults to artist name"
          slotProps={{ input: { maxLength: ARTIST_NAME_MAX_LENGTH } }}
        />
        {alphabeticalNameTooLong && (
          <FormHelperText>
            At most {ARTIST_NAME_MAX_LENGTH} characters
          </FormHelperText>
        )}
      </FormControl>

      <FormControl error={codeLettersTooLong}>
        <FormLabel>Call letters</FormLabel>
        <Input
          value={values.codeLetters}
          disabled={disabled}
          onChange={handleCodeLettersChange}
          placeholder="e.g. MO"
          slotProps={{
            input: {
              ref: codeLettersInputRef,
              maxLength: CODE_LETTERS_MAX_LENGTH,
            },
          }}
        />
        <FormHelperText>
          {codeLettersTooLong
            ? `At most ${CODE_LETTERS_MAX_LENGTH} characters`
            : `Up to ${CODE_LETTERS_MAX_LENGTH} characters, filed uppercase`}
        </FormHelperText>
      </FormControl>

      <FormControl error={codeNumberInvalid}>
        <FormLabel>Code number</FormLabel>
        <Input
          value={values.codeNumberRaw}
          disabled={disabled}
          onChange={(e) => onCodeNumberChange(e.target.value)}
          placeholder="e.g. 42"
        />
        {codeNumberInvalid && (
          <FormHelperText>
            {parsedCodeNumber === null
              ? "Must be a positive whole number"
              : `Must be no greater than ${CODE_NUMBER_MAX}`}
          </FormHelperText>
        )}
      </FormControl>

      {/* Gated on the same length the submit checks: uppercasing can push a
          value past the field's own maxLength ("ßxß" becomes "SSXSS"), which
          no series can ever hold, so previewing it would answer "Next code: 1"
          beside the length error that blocks the submit. */}
      <CallLetterPeekControl
        code_letters={codeLettersTooLong ? "" : values.codeLetters}
        genre_id={genreId}
      />

      {conflict?.response &&
        (isArtistNameConflictData(conflict.response) ? (
          <Typography level="body-sm" color="danger" role="alert">
            {conflict.name} is already taken in this genre by{" "}
            {conflict.response.artist.artist_name}.
          </Typography>
        ) : (
          <Typography level="body-sm" color="danger" role="alert">
            {conflict.code_letters}
            {conflict.code_number} is already taken by{" "}
            {conflict.response.artist.artist_name}.
          </Typography>
        ))}
    </Stack>
  );
}

export default NewArtistFields;
