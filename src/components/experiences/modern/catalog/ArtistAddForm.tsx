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
import { useAddArtistMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";
import type { AddArtistRequestBody, ArtistInGenreOption } from "@/lib/features/catalog/types";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import CallLetterPeekControl from "./CallLetterPeekControl";

/**
 * Body of the 409 Backend-Service returns from `POST /library/artists` when
 * the (code_letters, genre_id, code_number) triple is already taken
 * (library.controller.ts `addArtist`, via `getArtistByCode`).
 */
type AddArtistConflict = {
  message: string;
  artist: { artist_id: number; artist_name: string; code_letters: string };
};

function isAddArtistConflict(
  err: unknown,
): err is { status: 409; data: AddArtistConflict } {
  if (!err || typeof err !== "object" || !("status" in err)) return false;
  const { status, data } = err as { status?: unknown; data?: unknown };
  return (
    status === 409 &&
    !!data &&
    typeof data === "object" &&
    "artist" in data
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
  const { data: genres } = useGetGenresQuery();
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
  const trimmedCodeLetters = codeLetters.trim();
  const codeNumber = parseRequiredPositiveInt(codeNumberRaw);
  const codeNumberInvalid = codeNumberRaw.trim().length > 0 && codeNumber === null;

  const canSubmit =
    !isLoading &&
    existingArtist === null &&
    trimmedName.length > 0 &&
    genreId !== null &&
    trimmedCodeLetters.length > 0 &&
    codeNumber !== null;

  const handleNameChange = (value: string) => {
    setName(value);
    setAdded(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || genreId === null || codeNumber === null) return;

    const body: AddArtistRequestBody = {
      artist_name: trimmedName,
      code_letters: trimmedCodeLetters,
      genre_id: genreId,
      code_number: codeNumber,
      ...(alphabeticalName.trim()
        ? { alphabetical_name: alphabeticalName.trim() }
        : {}),
    };

    setConflict(null);
    try {
      const result = await addArtist(body).unwrap();
      setAdded({
        code_letters: trimmedCodeLetters,
        code_number: result.code_number ?? codeNumber,
      });
      setName("");
      setCodeLetters("");
      setCodeNumberRaw("");
      setAlphabeticalName("");
      setExistingArtist(null);
      toast.success(`Added ${trimmedName}`);
    } catch (err) {
      if (isAddArtistConflict(err)) {
        setConflict({
          code_letters: trimmedCodeLetters,
          code_number: codeNumberRaw.trim(),
          response: err.data,
        });
      } else {
        toast.error("Failed to add artist");
      }
    }
  };

  const handleCodeLettersChange = (value: string) => {
    setCodeLetters(value);
    setConflict(null);
  };

  const handleCodeNumberChange = (value: string) => {
    setCodeNumberRaw(value);
    setConflict(null);
  };

  return (
    <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
      <Typography level="title-md" sx={{ mb: 1 }}>
        Add artist
      </Typography>
      <form onSubmit={handleSubmit}>
        <Stack spacing={1.5}>
          <FormControl>
            <FormLabel>Genre</FormLabel>
            <Select
              placeholder="Select genre..."
              value={genreId}
              onChange={(_, value) => setGenreId(value)}
            >
              {(genres ?? []).map((genre) => (
                <Option key={genre.id} value={genre.id}>
                  {genre.genre_name}
                </Option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Artist name</FormLabel>
            <ArtistSearchTypeahead
              genreId={genreId ?? -1}
              value={name}
              onChange={handleNameChange}
              onSelect={setExistingArtist}
              onCreateNew={() => setExistingArtist(null)}
              onSelectionCleared={() => setExistingArtist(null)}
              disabled={genreId === null}
            />
            {existingArtist && (
              <FormHelperText sx={{ color: "danger.500" }}>
                {existingArtist.artist_name} already exists in this genre.
              </FormHelperText>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>Alphabetical name (optional)</FormLabel>
            <Input
              value={alphabeticalName}
              onChange={(e) => setAlphabeticalName(e.target.value)}
              placeholder="Defaults to artist name"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Call letters</FormLabel>
            <Input
              value={codeLetters}
              onChange={(e) => handleCodeLettersChange(e.target.value)}
              placeholder="e.g. MO"
            />
          </FormControl>

          <FormControl error={codeNumberInvalid}>
            <FormLabel>Code number</FormLabel>
            <Input
              value={codeNumberRaw}
              onChange={(e) => handleCodeNumberChange(e.target.value)}
              placeholder="e.g. 42"
            />
            {codeNumberInvalid && (
              <FormHelperText>Must be a positive whole number</FormHelperText>
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
