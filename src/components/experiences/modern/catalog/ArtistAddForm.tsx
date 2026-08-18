"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
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
  ARTIST_NAME_MAX_LENGTH,
  isAddArtistConflict,
  isArtistNameConflictData,
  isConflictRejection,
  validateNewArtistFields,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { AddArtistRequestBody } from "@/lib/features/catalog/types";
import { useArtistDedupCheck } from "@/src/hooks/catalogHooks";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import NewArtistFields, {
  type CodeLettersField,
  type NewArtistConflict,
} from "@/src/components/shared/inputs/NewArtistFields";

/**
 * MD-gated artist-add form. Dedups against existing artists via
 * `ArtistSearchTypeahead` and previews the call-letter assignment via
 * `NewArtistFields` before submitting `useAddArtistMutation`.
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
  const genresQuery = useGetGenresQuery();
  const {
    data: genres,
    isFetching: genresFetching,
    refetch: refetchGenres,
  } = genresQuery;
  const [addArtist, { isLoading }] = useAddArtistMutation();

  const [name, setName] = useState("");
  const [genreId, setGenreId] = useState<number | null>(null);
  const [codeLettersField, setCodeLettersField] = useState<CodeLettersField>({
    value: "",
    caret: null,
  });
  const [codeNumberRaw, setCodeNumberRaw] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");
  const [conflict, setConflict] = useState<NewArtistConflict | null>(null);
  const [added, setAdded] = useState<{ code_letters: string; code_number: number } | null>(
    null,
  );

  const trimmedName = name.trim();
  const nameTooLong = trimmedName.length > ARTIST_NAME_MAX_LENGTH;
  const dedup = useArtistDedupCheck(trimmedName);
  const {
    trimmedAlphabeticalName,
    trimmedCodeLetters,
    alphabeticalNameTooLong,
    codeLettersTooLong,
    codeNumber,
  } = validateNewArtistFields({
    alphabeticalName,
    codeLetters: codeLettersField.value,
    codeNumberRaw,
  });
  // See isGenresUnavailable's doc for why this is `data == null`, not
  // `isError`: a failed genres GET leaves an empty dropdown behind, and
  // `genre_id` is unreachable either way, so the outage has to say so rather
  // than presenting an empty list as "no genres exist" — but a refetch that
  // rejects over a good cached list must not read as the same outage.
  const genresUnavailable = isGenresUnavailable(genresQuery);

  const canSubmit =
    !isLoading &&
    dedup.existingArtist === null &&
    !dedup.dedupCheckStale &&
    // Each handler below clears `conflict` once its own edit could change the
    // rejected outcome — code_letters/code_number/genre for a code-triple
    // conflict, the name for a name conflict — so a standing conflict here
    // means the fields relevant to it are still exactly what the server just
    // rejected: resubmitting unchanged can only reach the same 409.
    conflict === null &&
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
    dedup.onNameChange(value);
    // A name conflict is keyed on the name itself, unlike the code-triple
    // conflict: editing it away from the rejected value is exactly the
    // remedy that lets a resubmission succeed, so it must not stay blocked by
    // state left over from the name the server actually rejected. A standing
    // code-triple conflict is untouched here — its triple has nothing to do
    // with the name field.
    if (conflict?.response && isArtistNameConflictData(conflict.response)) {
      setConflict(null);
    }
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
      dedup.reset();
      toast.success(`Added ${trimmedName}`);
    } catch (err) {
      if (isConflictRejection(err)) {
        setConflict({
          code_letters: trimmedCodeLetters,
          code_number: codeNumberRaw.trim(),
          name: trimmedName,
          response: isAddArtistConflict(err) ? err.data : null,
        });
      }
      if (!isAddArtistConflict(err) && isUnmessagedHttpError(err)) {
        // The global rtkQueryErrorLogger middleware already toasts the server
        // message for the common failure; only surface a fallback here for the
        // gap it leaves silent.
        toast.error("Failed to add artist");
      }
    }
  };

  // An edit to the code triple changes what the server was asked about the
  // code and nothing else. A standing NAME conflict has to survive it: the
  // name is still exactly the one that was rejected, and dropping the banner
  // would re-enable submit for a resubmission that can only reach the same
  // 409 — steering the librarian to keep adjusting a code that was never the
  // problem. Genre is deliberately not routed through here: the name check is
  // genre-scoped too, so changing it reopens both questions.
  const clearCodeTripleConflict = () => {
    setConflict((current) =>
      current?.response && isArtistNameConflictData(current.response)
        ? current
        : null,
    );
  };

  const handleCodeLettersFieldChange = (next: CodeLettersField) => {
    setCodeLettersField(next);
    clearCodeTripleConflict();
    setAdded(null);
  };

  const handleCodeNumberChange = (value: string) => {
    setCodeNumberRaw(value);
    clearCodeTripleConflict();
    setAdded(null);
  };

  const handleGenreChange = (value: number | null) => {
    setGenreId(value);
    // Uniqueness is (code_letters, genre_id, code_number) — a code the
    // server rejected under one genre may be free under another.
    setConflict(null);
    setAdded(null);
    dedup.onGenreChange();
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
              onSelect={dedup.onArtistSelected}
              onCreateNew={dedup.onCreateNewSelected}
              onSelectionCleared={dedup.onSelectionCleared}
              disabled={genreId === null || isLoading}
            />
            {nameTooLong ? (
              <FormHelperText>
                At most {ARTIST_NAME_MAX_LENGTH} characters
              </FormHelperText>
            ) : dedup.existingArtist ? (
              <FormHelperText sx={{ color: "danger.500" }}>
                {dedup.existingArtist.artist_name} already exists in this genre.
              </FormHelperText>
            ) : (
              dedup.dedupCheckStale && (
                <FormHelperText sx={{ color: "warning.500" }}>
                  Re-check this name under the new genre: pick the existing
                  artist from the suggestions, or choose &quot;Create new
                  artist&quot;.
                </FormHelperText>
              )
            )}
          </FormControl>

          <NewArtistFields
            alphabeticalName={alphabeticalName}
            codeNumberRaw={codeNumberRaw}
            codeLettersField={codeLettersField}
            onCodeLettersFieldChange={handleCodeLettersFieldChange}
            onCodeNumberChange={handleCodeNumberChange}
            onAlphabeticalNameChange={handleAlphabeticalNameChange}
            genreId={genreId}
            disabled={isLoading}
            conflict={conflict}
          />

          {added && (
            <Typography level="body-sm" color="success" role="status">
              Added as {added.code_letters}
              {added.code_number}.
            </Typography>
          )}

          <Button color="success" type="submit" loading={isLoading} disabled={!canSubmit}>
            Add artist
          </Button>
        </Stack>
      </form>
    </Sheet>
  );
}

export default ArtistAddForm;
