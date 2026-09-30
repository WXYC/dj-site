import "server-only";

import type { FlowsheetV2Entry, FlowsheetRangeResponse } from "@wxyc/shared";
import { fetchBackendSeed } from "../server-fetch";
import { computeHeadWindow, reverseWireOrder } from "./head-window";

export type ArchiveStreamSeed = {
  entries: FlowsheetV2Entry[];
};

// The head page's first window is canonical, request-time-knowable data
// requiring no auth -- the same `/flowsheet/range` request the client's first
// page makes. Server-rendering it puts populated rows in the initial HTML;
// the client query takes over once it mounts. On failure this returns an
// empty seed and the client query fills the listing.
export async function fetchArchiveStreamSeed(): Promise<ArchiveStreamSeed> {
  const head = computeHeadWindow(Date.now());
  const params = new URLSearchParams({
    start: String(head.start),
    end: String(head.requestEnd),
  });
  const raw = await fetchBackendSeed<FlowsheetRangeResponse | null>(
    `/flowsheet/range?${params.toString()}`,
  );
  return {
    entries: reverseWireOrder(raw?.entries ?? []),
  };
}
