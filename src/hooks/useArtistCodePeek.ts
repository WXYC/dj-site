"use client";

import { useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { usePeekArtistCodeQuery } from "@/lib/features/catalog/api";
import { CODE_LETTERS_MAX_LENGTH } from "@/lib/features/catalog/adminCreateArtistValidation";
import type { PeekArtistCodeQuery } from "@/lib/features/catalog/types";
import { useDebouncedValue } from "./useDebouncedValue";

const DEBOUNCE_MS = 150;

export type ArtistCodePeek = {
  /**
   * The letters/genre pair being previewed. Null while either half is
   * incomplete, or while the letters exceed the column's width — the same
   * length the submit gate checks, since a code no series can hold must not
   * preview as "Next code: 1" beside the length error that blocks the submit.
   */
  arg: PeekArtistCodeQuery | null;
  /** Debounce lag or fetch in flight: any value on hand answers a previous pair. */
  pending: boolean;
  isError: boolean;
  /** The number the next artist under `arg` would get; current only when `arg` is set and neither `pending` nor `isError`. */
  nextCodeNumber: number | null;
};

/**
 * MD-facing preview of the code number a new artist would be assigned for a
 * `code_letters` + `genre_id` pair (`GET /library/artists/peek-code`).
 *
 * One authoritative owner for the peeked value: the RTK Query cache entry
 * this hook subscribes to via `skipToken`. `NewArtistFields` derives both the
 * "Next code" line and the clean code-number field's rendered value from the
 * same result during render — nothing mirrors it into component state, and
 * because the subscription itself is skipped when there is no pair to preview,
 * the peeked number cannot outlive the arg that produced it.
 *
 * The query is not authorization-gated here: mount this only under an MD
 * gate, which every consumer (the artist-add form, the filing bench) already
 * provides around the whole field group.
 */
export function useArtistCodePeek(codeLetters: string, genreId: number | null): ArtistCodePeek {
  // code_letters and genre_id are debounced together as one composed value
  // so a genre change mid-typing can never pair with letters the user hasn't
  // finished composing (or vice versa).
  const trimmedCodeLetters = codeLetters.trim();
  const arg: PeekArtistCodeQuery | null = useMemo(
    () =>
      trimmedCodeLetters &&
      trimmedCodeLetters.length <= CODE_LETTERS_MAX_LENGTH &&
      genreId != null
        ? { code_letters: trimmedCodeLetters, genre_id: genreId }
        : null,
    [trimmedCodeLetters, genreId],
  );
  const debouncedArg = useDebouncedValue(arg, DEBOUNCE_MS);
  // The debounced value lags `arg` for DEBOUNCE_MS after every change; treat
  // that window as pending rather than presenting the previous pair's number
  // as though it were current.
  const stale = debouncedArg !== arg;

  // Subscribe to the debounced pair's cache entry; skip entirely when there
  // is nothing to preview. `currentData` (unlike `data`) is scoped to the
  // subscribed arg, so it withdraws to undefined the moment the arg is
  // skipped and never surfaces a slow response for superseded letters. The
  // default query behavior reuses a cached pair without re-hitting the
  // backend on every genre-dropdown flip-flop; the backend re-validates at
  // actual add time regardless of what this preview last showed.
  const { currentData, isFetching, isError } = usePeekArtistCodeQuery(
    debouncedArg ?? skipToken,
  );

  return {
    arg,
    pending: arg != null && (stale || isFetching),
    isError: arg != null && isError,
    // Current only for the live pair once it has settled: null while there is
    // no pair, during the debounce lag, and mid-fetch. A reader gating on
    // `pending`/`isError` and one reading `nextCodeNumber` directly therefore
    // never disagree about whether a number is on hand.
    nextCodeNumber:
      arg != null && !stale ? (currentData?.next_code_number ?? null) : null,
  };
}
