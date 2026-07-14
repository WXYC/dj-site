import type { FlowsheetEntry } from "./types";

export interface PartitionedEntries {
  current: FlowsheetEntry[];
  previous: FlowsheetEntry[];
}

/**
 * Display comparator for entries within the current show: play_order DESC,
 * id DESC tiebreak — matching the server's own per-show ordering
 * (`getEntriesByShow`). play_order is what `PATCH /play-order` rewrites, so
 * it must drive the current show's display order or a persisted reorder
 * never renders (the global feed sorts by id, which reorders don't touch).
 * The id tiebreak matters because play_orders can collide within a show
 * (tubafrenzy webhook and dj-site assign them independently).
 */
export function compareCurrentShowOrder(
  a: FlowsheetEntry,
  b: FlowsheetEntry
): number {
  if (a.play_order !== b.play_order) return b.play_order - a.play_order;
  return b.id - a.id;
}

/**
 * Partitions a sorted (id DESC) list of flowsheet entries into
 * "current show" and "previous shows" buckets.
 *
 * When live: current = ALL entries with show_id === currentShow
 * (including start/end markers), re-sorted by play_order DESC (id DESC
 * tiebreak) so drag reorders are reflected; previous = everything else,
 * left in id-DESC order.
 *
 * When not live (or no current show): current is empty,
 * previous is the full list.
 */
export function partitionFlowsheetEntries(
  allEntries: FlowsheetEntry[],
  currentShow: number,
  live: boolean
): PartitionedEntries {
  if (currentShow === -1 || !live) {
    return { current: [], previous: allEntries };
  }

  const current: FlowsheetEntry[] = [];
  const previous: FlowsheetEntry[] = [];

  for (const entry of allEntries) {
    if (entry.show_id === currentShow) {
      current.push(entry);
    } else {
      previous.push(entry);
    }
  }

  current.sort(compareCurrentShowOrder);

  return { current, previous };
}
