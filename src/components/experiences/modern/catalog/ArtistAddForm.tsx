"use client";

import { useState } from "react";
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
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";
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
 */
function normalizeCodeLetters(value: string): string {
  return value.toUpperCase();
}

function isAddArtistConflict(
  err: unknown,
): err is { status: 409; data: AddArtistConflict } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  const { status, data } = err as { status?: unknown; data?: unknown };
  if (status !== 409 || !data || typeof data !== "object") return false;
  // The banner dereferences `artist.artist_name` two levels down, so key
  // presence is not enough: a 409 carrying a null or nameless artist would
  // pass a `"artist" in data` guard and then throw during render, and there is
  // no error boundary in this subtree to catch it — white-screening the form
  // on an outcome that is supposed to be recoverable.
  const { artist } = data as { artist?: unknown };
  return (
    !!artist &&
    typeof artist === "object" &&
    typeof (artist as { artist_name?: unknown }).artist_name === "string"
  );
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
    isError: genresErrored,
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
  const [codeLetters, setCodeLetters] = useState("");
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
  // rejection sets `isError`, while the backend adapter's soft-fail turns a
  // non-JSON GET failure into `{ data: null }` with no error at all. Either
  // way `genre_id` is unreachable and the form can never submit, so the outage
  // has to say so rather than presenting an empty list as "no genres exist".
  const genresUnavailable = genresErrored || (!genresLoading && genres == null);

  const canSubmit =
    !isLoading &&
    existingArtist === null &&
    !dedupCheckStale &&
    trimmedName.length > 0 &&
    !nameTooLong &&
    !alphabeticalNameTooLong &&
    genreId !== null &&
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
      setCodeLetters("");
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

  const handleCodeLettersChange = (value: string) => {
    setCodeLetters(normalizeCodeLetters(value));
    setConflict(null);
  };

  const handleCodeNumberChange = (value: string) => {
    setCodeNumberRaw(value);
    setConflict(null);
  };

  const handleGenreChange = (value: number | null) => {
    setGenreId(value);
    // Uniqueness is (code_letters, genre_id, code_number) — a code the
    // server rejected under one genre may be free under another.
    setConflict(null);
    // Whatever the typeahead last reported was found under the previous genre.
    setDedupCheckStale(trimmedName.length > 0);
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
              onChange={(e) => setAlphabeticalName(e.target.value)}
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
              onChange={(e) => handleCodeLettersChange(e.target.value)}
              placeholder="e.g. MO"
              slotProps={{ input: { maxLength: CODE_LETTERS_MAX_LENGTH } }}
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

          <CallLetterPeekControl code_letters={codeLetters} genre_id={genreId} />

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
