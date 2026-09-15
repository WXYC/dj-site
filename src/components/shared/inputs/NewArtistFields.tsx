"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Stack,
  Typography,
} from "@mui/joy";

import {
  ARTIST_NAME_MAX_LENGTH,
  CODE_LETTERS_MAX_LENGTH,
  CODE_NUMBER_MAX,
  isArtistNameConflictData,
  normalizeCodeLetters,
  validateNewArtistFields,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type { AddArtistConflict } from "@/lib/features/catalog/types";
import CallLetterPeekControl from "@/src/components/shared/inputs/CallLetterPeekControl";
import { useArtistCodePeek } from "@/src/hooks/useArtistCodePeek";

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
  alphabeticalName: string;
  codeNumberRaw: string;
  /**
   * Must be caller-held state, never an object built inline in the caller's
   * JSX: the caret is restored in a layout effect keyed on this object's
   * identity, so a fresh literal every render would re-run the restore before
   * every paint, including paints caused by the other fields — dragging the
   * caret out from under an edit in progress. Holding it also keeps the value
   * and its caret under one owner, which is what `CodeLettersField` is for.
   */
  codeLettersField: CodeLettersField;
  onCodeLettersFieldChange: (next: CodeLettersField) => void;
  onCodeNumberChange: (value: string) => void;
  onAlphabeticalNameChange: (value: string) => void;
  genreId: number | null;
  disabled: boolean;
  conflict: NewArtistConflict | null;
  /**
   * Bench-style auto-fill: before the MD has touched the
   * code-number field it renders the live peeked number, and the caller's
   * submission omits `code_number` so the server assigns exactly what was
   * previewed. Off by default — the artist-add form keeps its typed-only
   * field, whose submit endpoint still requires the number.
   */
  autoFillCodeNumber?: boolean;
  /**
   * Accept a deliberate 0 as the code number (the compilation bucket lives at
   * `artist_genre_code = 0`, and Backend-Service imposes no floor above it).
   * Off by default: the artist-add form keeps its positive-only field, so a
   * stray 0 there is caught rather than filed into the compilation bucket.
   */
  allowZeroCodeNumber?: boolean;
};

/**
 * The field group an MD fills in to file an artist that does not exist yet:
 * alphabetical name, call letters, code number, the next-code preview, and the
 * conflict banner for a 409 on any of them.
 *
 * Fully controlled and free of any mutation — the artist name lives with
 * whatever typeahead decided this artist is new, which is outside this group,
 * and so does the submit. The one read this group owns is the code peek: the
 * field and the preview line both derive from that single subscription, which
 * is what lets `autoFillCodeNumber` render the peeked number without a second
 * copy of it anywhere.
 */
function NewArtistFields({
  alphabeticalName,
  codeNumberRaw,
  codeLettersField,
  onCodeLettersFieldChange,
  onCodeNumberChange,
  onAlphabeticalNameChange,
  genreId,
  disabled,
  conflict,
  autoFillCodeNumber = false,
  allowZeroCodeNumber = false,
}: NewArtistFieldsProps) {
  const codeLettersInputRef = useRef<HTMLInputElement | null>(null);
  const {
    alphabeticalNameTooLong,
    codeLettersTooLong,
    codeNumberInvalid,
    parsedCodeNumber,
  } = validateNewArtistFields(
    {
      alphabeticalName,
      codeNumberRaw,
      codeLetters: codeLettersField.value,
    },
    { allowZeroCodeNumber },
  );

  // One owner for the peeked number: this hook's RTK cache subscription. The
  // "Next code" line and the auto-filled field value below both derive from
  // it during render — the field shows the draft once touched and the peek
  // otherwise — which rules out mirroring the peek into state by effect.
  const peek = useArtistCodePeek(codeLettersField.value, genreId);

  // Whether the MD has touched the code-number field, tracked separately from
  // whether the draft is currently non-empty. Once touched, the field is a
  // plain controlled input showing exactly `codeNumberRaw`: clearing it stays
  // cleared (no snap-back to the peek that would drop the caret at the end and
  // make the next keystroke concatenate onto a number the MD tried to delete),
  // and an empty touched draft still submits no `code_number`, so the server
  // assigns the number the "Next code" line previews. Before the first touch
  // the field renders the live peek.
  const [codeNumberTouched, setCodeNumberTouched] = useState(false);
  const autoFillValue =
    autoFillCodeNumber && !peek.pending && !peek.isError && peek.nextCodeNumber != null
      ? String(peek.nextCodeNumber)
      : "";
  const codeNumberValue = codeNumberTouched ? codeNumberRaw : autoFillValue;

  const handleCodeNumberChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCodeNumberTouched(true);
    onCodeNumberChange(event.target.value);
  };

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
          value={alphabeticalName}
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
          value={codeLettersField.value}
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
          value={codeNumberValue}
          disabled={disabled}
          onChange={handleCodeNumberChange}
          placeholder="e.g. 42"
        />
        {codeNumberInvalid && (
          <FormHelperText>
            {parsedCodeNumber === null
              ? "Must be a whole number"
              : `Must be no greater than ${CODE_NUMBER_MAX}`}
          </FormHelperText>
        )}
      </FormControl>

      <CallLetterPeekControl peek={peek} />

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
