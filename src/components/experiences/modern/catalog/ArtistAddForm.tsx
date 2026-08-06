"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { useAddArtistMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import {
  isAddArtistConflict,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type {
  AddArtistConflict,
  AddArtistRequestBody,
  ArtistInGenreOption,
} from "@/lib/features/catalog/types";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import CallLetterPeekControl from "./CallLetterPeekControl";

/**
 * Column ceilings on the rows this form writes. Nothing between these fields
 * and the INSERT checks any of them — the handler validates only that the keys
 * are present — so an over-long or over-large value reaches PostgreSQL and
 * comes back as a 22001/22003 500 rather than a validation error. Each ceiling
 * has to hold here, and be visible to the MD rather than failing at the far
 * end of a submit.
 *
 * `artists.code_letters` is a `varchar(4)`; `artists.artist_name` and
 * `artists.alphabetical_name` are `varchar(128)`; the code number is filed as
 * `genre_artist_crossreference.artist_genre_code`, a PostgreSQL `integer`
 * whose range check fires at bind time, before the insert.
 */
const CODE_LETTERS_MAX_LENGTH = 4;
const ARTIST_NAME_MAX_LENGTH = 128;
const CODE_NUMBER_MAX = 2147483647;

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
function normalizeCodeLetters(value: string): string {
  return value.toUpperCase();
}

/**
 * MD-gated artist-add form. Dedups against existing artists via
 * `ArtistSearchTypeahead` and previews the call-letter assignment via
 * `CallLetterPeekControl` before submitting `useAddArtistMutation`.
 *
 * Submits dj-site's local `AddArtistRequestBody` (code_number required), not
 * the published `@wxyc/shared` `AddArtistRequest` — the latter omits
 * `code_number`, which Backend-Service 400s without.
 */
function ArtistAddForm() {
  return (
    <RequireMD>
      <ArtistAddFields />
    </RequireMD>
  );
}

function ArtistAddFields() {
  const {
    data: genres,
    isUninitialized: genresUnstarted,
    isLoading: genresLoading,
    isFetching: genresFetching,
    refetch: refetchGenres,
  } = useGetGenresQuery();
  const [addArtist, { isLoading }] = useAddArtistMutation();

  const [name, setName] = useState("");
  // The artist the typeahead most recently confirmed. Non-null means the
  // MD's search term names an artist that already exists in this genre, so
  // submitting would create a duplicate — the create action stays disabled
  // until either the text moves away from it or genreId changes, both of
  // which the typeahead reports via onSelectionCleared.
  const [existingArtist, setExistingArtist] = useState<ArtistInGenreOption | null>(
    null,
  );
  // A genre change retracts a held selection but does not re-run the search:
  // the typeahead's panel stays shut, so nothing checks the typed name against
  // the new genre. Treating the retraction as "this name is new here" would
  // turn a blocked duplicate into an enabled submit at the exact moment the
  // check matters, so the check is marked stale instead. It clears only on an
  // answer about the current genre — a row picked, "create new" chosen, or the
  // text changed to a different question altogether. Reopening the panel
  // re-runs the search but reports nothing back, so it does not clear this.
  const [dedupCheckStale, setDedupCheckStale] = useState(false);
  const [genreId, setGenreId] = useState<number | null>(null);
  // Value and caret are one state object because normalizing on every keystroke
  // makes them inseparable. Writing the uppercased text back into a controlled
  // input replaces `node.value`, and the HTML value setter drops the caret at
  // the end of the field; React only restores a selection across a commit when
  // focus moved, which it has not here. Left alone, an MD correcting a
  // character mid-code has the caret jump silently after the first lowercase
  // keystroke, so the next one lands at the end and files a different — but
  // still valid-looking — four-character code with nothing reported wrong.
  // Codes are written onto the physical cards, so a wrong-but-valid one is the
  // expensive outcome. Pairing the caret with the value is also what guarantees
  // the render the replacement below hangs off: an edit that only changed case
  // normalizes back to the string already held, and a state write of an equal
  // value would be skipped entirely.
  const [codeLettersField, setCodeLettersField] = useState<{
    value: string;
    caret: number | null;
  }>({ value: "", caret: null });
  const codeLetters = codeLettersField.value;
  const codeLettersInputRef = useRef<HTMLInputElement | null>(null);
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  // Snapshots the code the server actually rejected, alongside the response —
  // `conflict` must not be read against live `codeLetters`/`codeNumberRaw`,
  // since an MD editing either field after a 409 would otherwise have the
  // banner keep reporting the new, unsubmitted value as taken.
  const [conflict, setConflict] = useState<{
    code_letters: string;
    code_number: string;
    response: AddArtistConflict;
  } | null>(null);
  const [added, setAdded] = useState<{ code_letters: string; code_number: number } | null>(
    null,
  );

  const trimmedName = name.trim();
  const trimmedAlphabeticalName = alphabeticalName.trim();
  const trimmedCodeLetters = codeLetters.trim();
  const nameTooLong = trimmedName.length > ARTIST_NAME_MAX_LENGTH;
  const alphabeticalNameTooLong =
    trimmedAlphabeticalName.length > ARTIST_NAME_MAX_LENGTH;
  const codeLettersTooLong = trimmedCodeLetters.length > CODE_LETTERS_MAX_LENGTH;
  const parsedCodeNumber = parseRequiredPositiveInt(codeNumberRaw);
  // parseRequiredPositiveInt only rejects non-integers; the column's range is
  // this form's to enforce.
  const codeNumber =
    parsedCodeNumber !== null && parsedCodeNumber <= CODE_NUMBER_MAX
      ? parsedCodeNumber
      : null;
  const codeNumberInvalid = codeNumberRaw.trim().length > 0 && codeNumber === null;
  // A failed genres GET leaves an empty dropdown behind: fetchBaseQuery's
  // rejection leaves `data` undefined, while the backend adapter's soft-fail
  // turns a non-JSON GET failure into `{ data: null }` with no error at all.
  // Either way `genre_id` is unreachable and the form can never submit, so the
  // outage has to say so rather than presenting an empty list as "no genres
  // exist". The test is the absence of a list, not `isError`: a refetch that
  // rejects leaves the last good list in the cache and the form still submits
  // perfectly well against it, so reading the error flag would put a "can't be
  // filed right now" alert beside an enabled submit button. The query also
  // subscribes from an effect, so the mount render reports neither a pending
  // request nor data — reading that as an outage would announce the alert on
  // every mount, before anything has been asked.
  const genresUnavailable =
    !genresUnstarted && !genresLoading && genres == null;

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

  const canSubmit =
    !isLoading &&
    existingArtist === null &&
    !dedupCheckStale &&
    trimmedName.length > 0 &&
    !nameTooLong &&
    !alphabeticalNameTooLong &&
    genreId !== null &&
    // A list that goes away under a held selection leaves the dropdown showing
    // its placeholder while `genreId` still names the old genre. Submitting
    // then files under a genre the form has stopped displaying, beside an
    // alert saying nothing can be filed at all.
    !genresUnavailable &&
    trimmedCodeLetters.length > 0 &&
    !codeLettersTooLong &&
    codeNumber !== null;

  const handleNameChange = (value: string) => {
    setName(value);
    setAdded(null);
    // A different string is a different question: whatever the previous genre
    // said about the old text has nothing left to be stale about, and the edit
    // reopens the typeahead's panel to search the new text under the current
    // genre.
    setDedupCheckStale(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || genreId === null || codeNumber === null) return;

    const body: AddArtistRequestBody = {
      artist_name: trimmedName,
      code_letters: trimmedCodeLetters,
      genre_id: genreId,
      code_number: codeNumber,
      ...(trimmedAlphabeticalName
        ? { alphabetical_name: trimmedAlphabeticalName }
        : {}),
    };

    setConflict(null);
    try {
      const result = await addArtist(body).unwrap();
      // The assigned code comes from the 201 body, not from what was typed:
      // the two agree today, but only the server's copy is what was filed.
      setAdded({
        code_letters: result.code_letters ?? trimmedCodeLetters,
        code_number: result.code_number ?? codeNumber,
      });
      setName("");
      setCodeLettersField({ value: "", caret: null });
      setCodeNumberRaw("");
      setAlphabeticalName("");
      setExistingArtist(null);
      setDedupCheckStale(false);
      toast.success(`Added ${trimmedName}`);
    } catch (err) {
      if (isAddArtistConflict(err)) {
        setConflict({
          code_letters: trimmedCodeLetters,
          code_number: codeNumberRaw.trim(),
          response: err.data,
        });
      } else if (isUnmessagedHttpError(err)) {
        // The global rtkQueryErrorLogger middleware already toasts the server
        // message for the common failure; only surface a fallback here for the
        // gap it leaves silent.
        toast.error("Failed to add artist");
      }
    }
  };

  const handleCodeLettersChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.target;
    const raw = input.value;
    const caret = input.selectionStart;
    setCodeLettersField({
      value: normalizeCodeLetters(raw),
      // Uppercasing can lengthen the text before the caret ("ß" becomes "SS"),
      // so the caret's new home is the length of the normalized prefix, not
      // the index the browser reported against the raw text.
      caret:
        caret === null ? null : normalizeCodeLetters(raw.slice(0, caret)).length,
    });
    setConflict(null);
    setAdded(null);
  };

  const handleCodeNumberChange = (value: string) => {
    setCodeNumberRaw(value);
    setConflict(null);
    setAdded(null);
  };

  const handleGenreChange = (value: number | null) => {
    setGenreId(value);
    // Uniqueness is (code_letters, genre_id, code_number) — a code the
    // server rejected under one genre may be free under another.
    setConflict(null);
    setAdded(null);
    // Whatever the typeahead last reported was found under the previous genre.
    setDedupCheckStale(trimmedName.length > 0);
  };

  const handleAlphabeticalNameChange = (value: string) => {
    setAlphabeticalName(value);
    // The confirmation names a code that was already filed; leaving it beside
    // a half-typed next entry reads as that entry's outcome. It is not part of
    // the uniqueness triple, so a standing conflict stays accurate.
    setAdded(null);
  };

  return (
    <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
      <Typography level="title-md" sx={{ mb: 1 }}>
        Add artist
      </Typography>
      <form onSubmit={handleSubmit}>
        <Stack spacing={1.5}>
          <FormControl error={genresUnavailable}>
            <FormLabel>Genre</FormLabel>
            <Select
              placeholder="Select genre..."
              value={genreId}
              disabled={isLoading || genresUnavailable}
              onChange={(_, value) => handleGenreChange(value)}
            >
              {(genres ?? []).map((genre) => (
                <Option key={genre.id} value={genre.id}>
                  {genre.genre_name}
                </Option>
              ))}
            </Select>
            {genresUnavailable && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 0.5 }}
                role="alert"
              >
                <Typography level="body-sm" color="danger">
                  Genres are unavailable, so an artist can&apos;t be filed right now.
                </Typography>
                {/* An untyped button inside a form submits it. */}
                <Button
                  type="button"
                  size="sm"
                  variant="plain"
                  loading={genresFetching}
                  onClick={() => refetchGenres()}
                  sx={{ px: 0 }}
                >
                  Try again
                </Button>
              </Stack>
            )}
          </FormControl>

          <FormControl error={nameTooLong}>
            <FormLabel>Artist name</FormLabel>
            <ArtistSearchTypeahead
              genreId={genreId ?? -1}
              value={name}
              onChange={handleNameChange}
              onSelect={(artist) => {
                setExistingArtist(artist);
                setDedupCheckStale(false);
              }}
              onCreateNew={() => {
                setExistingArtist(null);
                setDedupCheckStale(false);
              }}
              onSelectionCleared={() => setExistingArtist(null)}
              disabled={genreId === null || isLoading}
            />
            {nameTooLong ? (
              <FormHelperText>
                At most {ARTIST_NAME_MAX_LENGTH} characters
              </FormHelperText>
            ) : existingArtist ? (
              <FormHelperText sx={{ color: "danger.500" }}>
                {existingArtist.artist_name} already exists in this genre.
              </FormHelperText>
            ) : (
              dedupCheckStale && (
                <FormHelperText sx={{ color: "warning.500" }}>
                  Re-check this name under the new genre: pick the existing
                  artist from the suggestions, or choose &quot;Create new
                  artist&quot;.
                </FormHelperText>
              )
            )}
          </FormControl>

          <FormControl error={alphabeticalNameTooLong}>
            <FormLabel>Alphabetical name (optional)</FormLabel>
            <Input
              value={alphabeticalName}
              disabled={isLoading}
              onChange={(e) => handleAlphabeticalNameChange(e.target.value)}
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
              value={codeLetters}
              disabled={isLoading}
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
              value={codeNumberRaw}
              disabled={isLoading}
              onChange={(e) => handleCodeNumberChange(e.target.value)}
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
              value past the field's own maxLength ("ßxß" becomes "SSXSS"),
              which no series can ever hold, so previewing it would answer
              "Next code: 1" beside the length error that blocks the submit. */}
          <CallLetterPeekControl
            code_letters={codeLettersTooLong ? "" : codeLetters}
            genre_id={genreId}
          />

          {conflict && (
            <Typography level="body-sm" color="danger" role="alert">
              {conflict.code_letters}
              {conflict.code_number} is already taken by{" "}
              {conflict.response.artist.artist_name}.
            </Typography>
          )}

          {added && (
            <Typography level="body-sm" color="success" role="status">
              Added as {added.code_letters}
              {added.code_number}.
            </Typography>
          )}

          <Button type="submit" loading={isLoading} disabled={!canSubmit}>
            Add artist
          </Button>
        </Stack>
      </form>
    </Sheet>
  );
}

export default ArtistAddForm;
