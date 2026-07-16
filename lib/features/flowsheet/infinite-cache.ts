import { safeCapture } from "@/lib/posthog";
import { hasLinkedAlbumId } from "./linkage";
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

/**
 * Newest entry's `show_id`, skipping orphaned entries (show_id exactly -1,
 * from convertV2Entry's null mapping), or `-1` if none. The skip matters:
 * partitionFlowsheetEntries treats currentShow -1 as "nobody is live", so a
 * single orphaned newest row must not masquerade as that sentinel and flip
 * the whole live show into "previous". Other negative show_ids are NOT
 * skipped — the #619 fix pushes an optimistic show-start marker whose
 * show_id is a fresh negative tempId, and it must win here so the prior
 * show's tail stops partitioning as current during the goLive window.
 */
export function primaryShowId(draft: Pick<InfiniteEntriesDraft, "pages">): number {
  for (const page of draft.pages) {
    for (const e of page) {
      if (e.show_id !== -1) return e.show_id;
    }
  }
  return -1;
}

// Monotonic counter, not Date.now()+random: two submissions in the same
// millisecond had a real collision chance, and a collision makes
// replaceEntryIdAllPages silently drop one of the rows (#620). Seeded from
// the clock so a Fast-Refresh module re-eval can't reissue an id still held
// by an in-flight optimistic row. More-negative = newer, which
// compareEntriesNewestFirst relies on.
let optimisticTempIdCounter = Date.now();

export function nextOptimisticTempId(): number {
  return -++optimisticTempIdCounter;
}

export function buildOptimisticEntry(
  arg: FlowsheetSubmissionParams,
  draft: Pick<InfiniteEntriesDraft, "pages">
): { entry: FlowsheetEntry; tempId: number } {
  const tempId = nextOptimisticTempId();
  const play_order = maxPlayOrder(draft) + 1;
  // -1 is the shared unknown-show sentinel (primaryShowId, convertV2Entry);
  // 0 collides with a real show id (#629). Server response replaces the row.
  const show_id = primaryShowId(draft);

  if ("message" in arg) {
    const entry: FlowsheetMessageEntry = {
      id: tempId,
      play_order,
      show_id,
      message: arg.message,
    };
    return { entry, tempId };
  }

  // Key presence isn't enough: callers can pass `album_id: undefined` (or a
  // synthesized negative id for library-unlinked rows), which must render
  // the freeform variant, not a blank catalog row (#607).
  if ("album_id" in arg && hasLinkedAlbumId(arg.album_id)) {
    const entry: FlowsheetSongEntry = {
      id: tempId,
      play_order,
      show_id,
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

  // Freeform submissions — and linked-shape args whose album_id wasn't a
  // usable positive id — render whatever typed fields they carry.
  const entry: FlowsheetSongEntry = {
    id: tempId,
    play_order,
    show_id,
    track_title: arg.track_title,
    artist_name: "artist_name" in arg ? arg.artist_name : "",
    album_title: "album_title" in arg ? arg.album_title : "",
    record_label: arg.record_label ?? "",
    request_flag: arg.request_flag,
    segue: arg.segue,
  };
  return { entry, tempId };
}

/**
 * Sort comparator for FlowsheetEntry: newest-first (descending).
 * Uses `id` as the global sort key since it's monotonically increasing across
 * all shows, unlike `play_order` which resets per show. Optimistic temp entries
 * (negative IDs from `nextOptimisticTempId`) always sort before real entries
 * since they represent the most recent additions.
 */
export function compareEntriesNewestFirst(a: FlowsheetEntry, b: FlowsheetEntry): number {
  const aTemp = a.id < 0;
  const bTemp = b.id < 0;
  if (aTemp !== bTemp) return aTemp ? -1 : 1;
  if (aTemp) return a.id - b.id; // more negative = newer (later counter value)
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

/**
 * Remove every row carrying `id` from every page. All copies must go, including
 * duplicates on a single page, because the swap below relies on the id surviving
 * on no page. Iterate back-to-front so a splice can't shift an unchecked row
 * past the cursor.
 */
export function removeEntryById(draft: InfiniteEntriesDraft, id: number): boolean {
  let removed = false;
  for (const page of draft.pages) {
    for (let i = page.length - 1; i >= 0; i--) {
      if (page[i].id === id) {
        page.splice(i, 1);
        removed = true;
      }
    }
  }
  return removed;
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

/**
 * Replace the optimistic `tempId` row with `serverEntry`. A refetch may have
 * already placed the real row in the cache before this runs, so `serverEntry.id`
 * is removed before inserting to keep it present exactly once.
 */
export function replaceEntryIdAllPages(
  draft: InfiniteEntriesDraft,
  tempId: number,
  serverEntry: FlowsheetEntry
): void {
  const tempRemoved = removeEntryById(draft, tempId);
  const serverRowAlreadyPresent = removeEntryById(draft, serverEntry.id);
  insertEntrySortedFirstPage(draft, serverEntry);

  // A miss only when neither row was present: an already-present server row is a
  // benign refetch-race, not a lost optimistic entry.
  if (!tempRemoved && !serverRowAlreadyPresent) {
    safeCapture("flowsheet_optimistic_replace_miss", {
      tempId,
      serverEntryId: serverEntry.id,
    });
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[flowsheet] replaceEntryIdAllPages: tempId ${tempId} not in cache (dj-site#860)`
      );
    }
  }
}

/**
 * Move `entryId` to `newPosition`, renumbering the crossed block of same-show
 * entries by ±1 — mirrors `PATCH /play-order` exactly so the optimistic state
 * matches what the server persists at any move distance. Other shows are
 * untouched (play_order is per-show; values collide across shows).
 */
export function movePlayOrder(
  draft: InfiniteEntriesDraft,
  entryId: number,
  newPosition: number
): void {
  let moved: FlowsheetEntry | undefined;
  for (const page of draft.pages) {
    for (const e of page) {
      if (e.id === entryId) moved = e;
    }
  }
  if (!moved) return;
  // Orphaned entries (show_id exactly -1) don't form a real per-show block —
  // two unrelated orphans would renumber each other's play_order. Other
  // negative show_ids are coherent optimistic show blocks (#619 marker) and
  // may renumber normally.
  if (moved.show_id === -1) return;
  const oldPosition = moved.play_order;
  if (oldPosition === newPosition) return;
  const showId = moved.show_id;

  for (const page of draft.pages) {
    for (const e of page) {
      if (e.id === entryId || e.show_id !== showId) continue;
      if (
        newPosition > oldPosition &&
        e.play_order > oldPosition &&
        e.play_order <= newPosition
      ) {
        e.play_order -= 1;
      } else if (
        newPosition < oldPosition &&
        e.play_order >= newPosition &&
        e.play_order < oldPosition
      ) {
        e.play_order += 1;
      }
    }
  }
  moved.play_order = newPosition;
}
