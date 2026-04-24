import type { FlowsheetEntry } from "./types";

export interface PartitionedEntries {
  current: FlowsheetEntry[];
  previous: FlowsheetEntry[];
}

/**
 * Partitions a sorted (play_order DESC) list of flowsheet entries into
 * "current show" and "previous shows" buckets.
 *
 * When live: current = ALL entries with show_id === currentShow
 * (including start/end markers); previous = everything else.
 *
 * When not live (or no current show): current is empty,
 * previous is the full list.
 *
 * Invariant: [...current, ...previous] preserves the original
 * play_order-DESC ordering because all current-show entries have higher
 * play_orders than any previous-show entries.
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

  return { current, previous };
}
