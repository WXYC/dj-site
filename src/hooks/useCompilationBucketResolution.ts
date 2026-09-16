"use client";

import { useCallback, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useResolveArtistByCodeQuery } from "@/lib/features/catalog/api";
import {
  VARIOUS_ARTISTS_CODE_LETTERS,
  VARIOUS_ARTISTS_CODE_NUMBER,
} from "@/lib/features/catalog/libraryCode";
import { resolveArtistByCodeErrorReason } from "@/lib/features/catalog/libraryCodeResolution";
import type { ArtistByCodeOwner, ResolveArtistByCodeQuery } from "@/lib/features/catalog/types";

/**
 * What the genre's compilation shelf answered, as the one value every consumer
 * branches on.
 *
 * - `idle` — compilation state is off; nothing is subscribed.
 * - `resolving` — in flight, including a refetch over a retained answer.
 * - `existing` — exactly one bucket owns the code; it is the filing's artist.
 * - `picking` — several buckets share the code (the shelf's normal shape for
 *   Rock and Soundtracks); the librarian names which one.
 * - `create` — the genre has no compilation bucket yet.
 * - `genre-missing` — no genre in the catalog has that id.
 * - `unavailable` — every answer that cannot be acted on. Never `create`:
 *   reading an outage as "code free" is what mints a duplicate bucket.
 */
export type CompilationBucketOutcome =
  | "idle"
  | "resolving"
  | "existing"
  | "picking"
  | "create"
  | "genre-missing"
  | "unavailable";

export type CompilationBucketResolution = {
  outcome: CompilationBucketOutcome;
  /** The buckets sharing the genre's compilation code; empty unless settled. */
  owners: ArtistByCodeOwner[];
  /**
   * The artist the filing would use: the sole owner, or the librarian's pick.
   * Null whenever the outcome is one submit must not act on, so a reader
   * gating on `outcome` and one reading this directly never disagree.
   */
  resolvedArtistId: number | null;
  pick: (artistId: number) => void;
  /**
   * Forget the pick. The post-filing reset preserves the genre, so without
   * this the next record of a same-genre batch inherits the previous one's
   * bucket with no librarian gesture.
   */
  clearPick: () => void;
  refetch: () => void;
};

/**
 * Resolves a genre's Various Artists shelf by its code triple — the exact,
 * synonym-independent lookup (`GET /library/artists/by-code`), never a search
 * on the artist's name: the shelf holds `Soundtracks - <letter>` buckets that
 * contain no "various" anywhere, and the sub-bucket letter survives only in
 * that name.
 *
 * Subscribed rather than gesture-fired, so it re-keys on a genre change with
 * no effect and no manual trigger. `currentData` (not `data`) is what the
 * outcome derives from: RTK keeps serving the previous arg's payload through
 * the in-flight window after an arg change, and a slow answer for the genre
 * the librarian just left must never arm a filing for the genre they are on.
 *
 * Mount this only under an MD gate — the filing bench already provides one
 * around the whole form.
 */
export function useCompilationBucketResolution(
  active: boolean,
  genreId: number | null,
): CompilationBucketResolution {
  const arg: ResolveArtistByCodeQuery | null = useMemo(
    () =>
      active && genreId !== null
        ? {
            genre_id: genreId,
            code_letters: VARIOUS_ARTISTS_CODE_LETTERS,
            code_number: VARIOUS_ARTISTS_CODE_NUMBER,
          }
        : null,
    [active, genreId],
  );

  const {
    currentData,
    error,
    isFetching,
    refetch: refetchQuery,
  } = useResolveArtistByCodeQuery(arg ?? skipToken);

  // Stored with the genre it was made under, so a genre change drops it during
  // render instead of through a clearing effect.
  const [picked, setPicked] = useState<{ genreId: number; artistId: number } | null>(null);

  const owners = useMemo(() => currentData?.artists ?? [], [currentData]);

  const outcome: CompilationBucketOutcome = useMemo(() => {
    if (arg === null) return "idle";
    // Ahead of `error` deliberately: RTK retains the previous rejection while
    // a refetch is in flight, and a retained `code_not_assigned` read as
    // `create` would arm the duplicate the refetch exists to prevent.
    if (isFetching) return "resolving";
    if (error) {
      const reason = resolveArtistByCodeErrorReason(error);
      if (reason === "code_not_assigned") return "create";
      if (reason === "genre_not_found") return "genre-missing";
      return "unavailable";
    }
    if (currentData === undefined) return "resolving";
    // An empty list is not "none assigned" — an unassigned code is a 404. It
    // is the value an unreadable body normalizes onto, so it fails closed.
    if (owners.length === 0) return "unavailable";
    return owners.length === 1 ? "existing" : "picking";
  }, [arg, isFetching, error, currentData, owners]);

  const pickedId =
    picked !== null && picked.genreId === genreId ? picked.artistId : null;

  const resolvedArtistId = useMemo(() => {
    if (outcome === "existing") return owners[0].id;
    if (outcome !== "picking") return null;
    // A pick the current answer no longer contains cannot arm a filing: a
    // refetch can reshape the shelf under a pick already made.
    return owners.some((owner) => owner.id === pickedId) ? pickedId : null;
  }, [outcome, owners, pickedId]);

  const pick = useCallback(
    (artistId: number) => {
      if (genreId === null) return;
      setPicked({ genreId, artistId });
    },
    [genreId],
  );

  const clearPick = useCallback(() => setPicked(null), []);

  const refetch = useCallback(() => {
    // `refetch` throws on a query created with `skipToken`; the panel that
    // calls this only mounts while active, but the surface is safe on its own
    // terms rather than by its caller's construction.
    if (arg === null) return;
    refetchQuery();
  }, [arg, refetchQuery]);

  return { outcome, owners, resolvedArtistId, pick, clearPick, refetch };
}
