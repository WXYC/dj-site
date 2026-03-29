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
  const show_id = sid >= 0 ? sid : 0;

  if ("message" in arg) {
    const entry: FlowsheetMessageEntry = {
      id: tempId,
      play_order,
      show_id,
      message: arg.message,
    };
    return { entry, tempId };
  }

  if ("album_id" in arg) {
    const entry: FlowsheetSongEntry = {
      id: tempId,
      play_order,
      show_id,
      track_title: arg.track_title,
      artist_name: "",
      album_title: "",
      record_label: arg.record_label ?? "",
      request_flag: arg.request_flag,
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
    track_title: arg.track_title,
    artist_name: arg.artist_name,
    album_title: arg.album_title,
    record_label: arg.record_label ?? "",
    request_flag: arg.request_flag,
  };
  return { entry, tempId };
}

/** Insert so `pages[0]` stays sorted by `play_order` descending (highest first). */
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
  const idx = page0.findIndex((e) => e.play_order < entry.play_order);
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
  for (const page of draft.pages) {
    const index = page.findIndex((item) => item.id === tempId);
    if (index !== -1) {
      page[index] = serverEntry;
      return;
    }
  }
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
