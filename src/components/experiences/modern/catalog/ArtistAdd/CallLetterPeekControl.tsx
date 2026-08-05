"use client";

import { useEffect } from "react";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useLazyPeekArtistCodeQuery } from "@/lib/features/catalog/api";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

const DEBOUNCE_MS = 150;

export interface CallLetterPeekControlProps {
  code_letters: string;
  genre_id: number | null;
}

/**
 * MD+ preview of the code number a new artist would be assigned for a given
 * `code_letters` + `genre_id` pair, ahead of committing the artist-add form.
 * Controlled by props (no internal draft state) so the artist-add form can
 * drive it directly from its own field state.
 */
function CallLetterPeekControl({ code_letters, genre_id }: CallLetterPeekControlProps) {
  const [peekArtistCode, { data, isFetching, error }] = useLazyPeekArtistCodeQuery();
  const debouncedCodeLetters = useDebouncedValue(code_letters, DEBOUNCE_MS);
  const ready = debouncedCodeLetters.length > 0 && genre_id != null;

  useEffect(() => {
    if (!ready) return;
    peekArtistCode({ code_letters: debouncedCodeLetters, genre_id: genre_id as number });
  }, [ready, debouncedCodeLetters, genre_id, peekArtistCode]);

  if (!ready) return null;

  return (
    <RequireMD>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="body-sm">Next code:</Typography>
        {isFetching ? (
          <CircularProgress size="sm" aria-label="Loading next code number" />
        ) : error ? (
          <Typography level="body-sm" color="danger">
            Unable to preview code
          </Typography>
        ) : data ? (
          <Typography level="body-sm" fontWeight="lg" aria-label="Next code number">
            {data.next_code_number}
          </Typography>
        ) : null}
      </Stack>
    </RequireMD>
  );
}

export default CallLetterPeekControl;
