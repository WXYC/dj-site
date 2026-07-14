import type { FlowsheetEntry } from "./types";

export interface PartitionedEntries {
  current: FlowsheetEntry[];
  previous: FlowsheetEntry[];
}

/**
 * Current-show display order: play_order DESC, id DESC tiebreak, matching
 * the server's per-show ordering. play_order must drive display here or
 * persisted reorders never render (the global feed sorts by id, which
 * `PATCH /play-order` doesn't touch); the id tiebreak covers colliding
 * play_orders (tubafrenzy and dj-site assign them independently).
 */
export function compareCurrentShowOrder(
  a: FlowsheetEntry,
  b: FlowsheetEntry
): number {
  if (a.play_order !== b.play_order) return b.play_order - a.play_order;
  return b.id - a.id;
}

/**
 * Partitions a sorted (id DESC) entry list into "current show" (all entries
 * with the live show's id, including start/end markers, re-sorted by
 * compareCurrentShowOrder so reorders render) and "previous shows" (left in
 * id-DESC order). When not live: current is empty, previous is everything.
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
