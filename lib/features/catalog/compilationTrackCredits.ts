import type { CompilationTrack, CompilationTrackInput, CompilationTrackList } from "./types";

/**
 * The server's uniqueness key for a per-track credit, mirrored client-side.
 * `POST /:libraryId/compilation-tracks` dedupes on `(artist_name,
 * track_title)`, so `track_position` is excluded here too: two rows differing
 * only in position are one credit to the endpoint, and the second is skipped
 * rather than filed.
 *
 * Both fields are free text, so the pair is serialized rather than joined —
 * `("Cat", "Power Ballad")` and `("Cat Power", "Ballad")` must stay distinct,
 * and no separator character is safe to assume absent from a title.
 *
 * Every screen that writes to that additive-only endpoint has to agree with
 * this rule, or it offers as new a row the server will silently skip, or loses
 * track of one it will silently duplicate under a corrected spelling. One
 * definition, not one per screen.
 */
export function compilationTrackCreditKey(track: CompilationTrackInput): string {
  return JSON.stringify([track.artist_name.trim(), track.track_title?.trim() ?? ""]);
}

/** One row of hand-editable per-track credit, before it is filed. */
export type DraftRow = {
  /** Stable across edits and removals, so React never reuses one row's DOM for another. */
  key: number;
  artist_name: string;
  track_title: string;
  track_position: string;
};

let nextRowKey = 0;

export const blankRow = (): DraftRow => ({
  key: nextRowKey++,
  artist_name: "",
  track_title: "",
  track_position: "",
});

export const rowFromSuggestion = (track: CompilationTrackInput): DraftRow => ({
  key: nextRowKey++,
  artist_name: track.artist_name,
  track_title: track.track_title ?? "",
  track_position: track.track_position ?? "",
});

/** Blank optional fields are stored as NULL, not as empty strings — matches the write endpoint's own convention. */
export const toInput = (row: DraftRow): CompilationTrackInput => ({
  artist_name: row.artist_name.trim(),
  track_title: row.track_title.trim() || null,
  track_position: row.track_position.trim() || null,
});

/**
 * Where the rows on screen came from. The manual arm carries its reason
 * because the three ways of arriving there are not interchangeable: "Discogs
 * had nothing", "Discogs had only what is already filed", and "the librarian
 * chose to type them" are three different claims, and stating the first when
 * either of the others is true sends the librarian to the sleeve for a
 * tracklist they do not need to type.
 */
export type Seed =
  | { kind: "discogs"; importedCount: number; alreadyFiledCount: number }
  | { kind: "manual"; reason: "no-match" | "all-filed" | "chosen" };

/**
 * A read that only exists to gate a write fails *closed*, not open: known
 * only once the read has actually succeeded and settled — never inferred from
 * an empty or stale payload, which is indistinguishable from "not loaded yet"
 * the moment a stale refetch is in flight.
 */
export function isStoredKnown(params: {
  /**
   * The read's whole payload, deliberately not a truthiness-friendly shape:
   * the unwrapped `tracks` array is always truthy, so passing it would report
   * "known" before the read landed and invert this gate from closed to open.
   * Typing it to the payload makes that a compile error.
   */
  stored: CompilationTrackList | undefined;
  storedError: boolean;
  storedFetching: boolean;
}): boolean {
  return !!params.stored && !params.storedError && !params.storedFetching;
}

/**
 * Classifies the Discogs suggestions against what is already stored, and
 * derives the rows to seed the form with.
 *
 * Allocates row keys as it goes, so two calls with identical arguments return
 * rows with different `key`s. Call it to commit a seed, not to inspect one:
 * it is not safe to memoize, and two results are not comparable by value.
 *
 * `alreadyFiledCount` is `suggestions.length - fresh.length`. The "all-filed"
 * reason is reached only when `fresh.length === 0`, at which point
 * `alreadyFiledCount > 0` and `suggestions.length > 0` agree on every input —
 * both simplify to "did Discogs list anything that got filtered out" once
 * `fresh.length` is pinned at zero. That is the single surviving formula:
 * `alreadyFiledCount > 0 ? "all-filed" : "no-match"`.
 */
export function classifySeed(
  suggestions: CompilationTrackInput[],
  stored: CompilationTrack[],
): { seed: Seed; rows: DraftRow[] } {
  const alreadyFiled = new Set(stored.map(compilationTrackCreditKey));
  const fresh = suggestions.filter((track) => !alreadyFiled.has(compilationTrackCreditKey(track)));
  const alreadyFiledCount = suggestions.length - fresh.length;

  if (fresh.length > 0) {
    return {
      seed: { kind: "discogs", importedCount: fresh.length, alreadyFiledCount },
      rows: fresh.map(rowFromSuggestion),
    };
  }

  return {
    seed: {
      kind: "manual",
      // Discogs having matched every track that is already filed is not
      // Discogs having no match, though the sleeve may still hold one it
      // missed.
      reason: alreadyFiledCount > 0 ? "all-filed" : "no-match",
    },
    rows: [blankRow()],
  };
}
