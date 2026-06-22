import type {
  FlowsheetEntry,
  FlowsheetMessageEntry,
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "./types";

/** Draft shape for RTK `getInfiniteEntries` cache (Immer draft). */
export type InfiniteEntriesDraft = {
  pages: FlowsheetEntry[][];
  pageParams: number[];
};

export function maxPlayOrder(draft: Pick<InfiniteEntriesDraft, "pages">): number {
  let m = 0;
  for (const page of draft.pages) {
    for (const e of page) {
      if (e.play_order > m) m = e.play_order;
    }
  }
  return m;
}

/** First non-empty `show_id` in page order, or `-1` if none. */
export function primaryShowId(draft: Pick<InfiniteEntriesDraft, "pages">): number {
  for (const page of draft.pages) {
    if (page.length > 0) return page[0].show_id;
  }
  return -1;
}

export function nextOptimisticTempId(): number {
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

export function buildOptimisticEntry(
  arg: FlowsheetSubmissionParams,
  draft: Pick<InfiniteEntriesDraft, "pages">
): { entry: FlowsheetEntry; tempId: number } {
  const tempId = nextOptimisticTempId();
  const play_order = maxPlayOrder(draft) + 1;
  const sid = primaryShowId(draft);
  // Fallback until POST response replaces row (empty cache / unknown show).
  const show_id = sid >= 0 ? sid : 0;
  // Stand-in for the server's INSERT timestamp until the POST response
  // replaces the row. Within a single client this is monotonic, so back-to-
  // back optimistic temps sort newest-first in the same way as real rows.
  // See WXYC/dj-site#746.
  const add_time = Date.now();

  if ("message" in arg) {
    const entry: FlowsheetMessageEntry = {
      id: tempId,
      play_order,
      show_id,
      add_time,
      message: arg.message,
    };
    return { entry, tempId };
  }

  if ("album_id" in arg) {
    const entry: FlowsheetSongEntry = {
      id: tempId,
      play_order,
      show_id,
      add_time,
      track_title: arg.track_title,
      artist_name: "",
      album_title: "",
      record_label: arg.record_label ?? "",
      request_flag: arg.request_flag,
      segue: arg.segue,
      album_id: arg.album_id,
      rotation_id: arg.rotation_id,
      rotation: arg.rotation_bin,
    };
    return { entry, tempId };
  }

  const entry: FlowsheetSongEntry = {
    id: tempId,
    play_order,
    show_id,
    add_time,
    track_title: arg.track_title,
    artist_name: arg.artist_name,
    album_title: arg.album_title,
    record_label: arg.record_label ?? "",
    request_flag: arg.request_flag,
    segue: arg.segue,
  };
  return { entry, tempId };
}

/**
 * Sort comparator for FlowsheetEntry: newest-first (descending).
 *
 * Primary key is `add_time` — server INSERT timestamp (epoch ms), or
 * `Date.now()` snapshot on optimistic temps. `add_time` is the authoritative
 * chronological signal: `id` is a sequence value that can run out of order
 * with chronology (legacy-sync backfill, retried inserts, concurrent
 * inserts), and `play_order` resets per show. See WXYC/dj-site#746.
 *
 * `id` is the tiebreaker for entries that share an add_time (server clock
 * collisions, missing-add_time legacy rows that parse to 0). Among ties,
 * optimistic temps (negative ids from `nextOptimisticTempId`) sort newest
 * because more-negative = later `Date.now()`.
 */
export function compareEntriesNewestFirst(a: FlowsheetEntry, b: FlowsheetEntry): number {
  if (a.add_time !== b.add_time) return b.add_time - a.add_time;
  const aTemp = a.id < 0;
  const bTemp = b.id < 0;
  if (aTemp !== bTemp) return aTemp ? -1 : 1;
  if (aTemp) return a.id - b.id; // more negative = newer (larger Date.now())
  return b.id - a.id;
}

/** Insert so `pages[0]` stays sorted by id descending (newest first). */
export function insertEntrySortedFirstPage(
  draft: InfiniteEntriesDraft,
  entry: FlowsheetEntry
): void {
  if (!draft.pages.length) {
    draft.pages.push([entry]);
    draft.pageParams.push(0);
    return;
  }
  const page0 = draft.pages[0];
  const idx = page0.findIndex((e) => compareEntriesNewestFirst(entry, e) < 0);
  if (idx === -1) {
    page0.push(entry);
  } else {
    page0.splice(idx, 0, entry);
  }
}

export function removeEntryById(draft: InfiniteEntriesDraft, id: number): void {
  for (const page of draft.pages) {
    const index = page.findIndex((item) => item.id === id);
    if (index !== -1) {
      page.splice(index, 1);
      return;
    }
  }
}

export function patchEntryById(
  draft: InfiniteEntriesDraft,
  id: number,
  data: Partial<FlowsheetEntry>
): void {
  for (const page of draft.pages) {
    const index = page.findIndex((item) => item.id === id);
    if (index !== -1) {
      Object.assign(page[index], data);
      return;
    }
  }
}

/** Replace the entry with `tempId` everywhere it appears with `serverEntry`. */
export function replaceEntryIdAllPages(
  draft: InfiniteEntriesDraft,
  tempId: number,
  serverEntry: FlowsheetEntry
): void {
  removeEntryById(draft, tempId);
  insertEntrySortedFirstPage(draft, serverEntry);
}

export function swapPlayOrdersForSwitch(
  draft: InfiniteEntriesDraft,
  entryId: number,
  newPosition: number
): void {
  let a: FlowsheetEntry | undefined;
  let b: FlowsheetEntry | undefined;
  for (const page of draft.pages) {
    for (const e of page) {
      if (e.id === entryId) a = e;
      if (e.play_order === newPosition) b = e;
    }
  }
  if (!a || !b || a.id === b.id) return;
  const poA = a.play_order;
  a.play_order = b.play_order;
  b.play_order = poA;
}
