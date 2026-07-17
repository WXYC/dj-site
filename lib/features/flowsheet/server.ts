import "server-only";

import { fetchBackendSeed } from "../server-fetch";
import { convertDJsOnAir, convertV2Entry } from "./conversions";
import {
  FlowsheetEntry,
  FlowsheetV2EntryJSON,
  OnAirDJData,
  OnAirDJResponse,
} from "./types";

/**
 * Current now-playing entry for seeding the public NowPlaying widget.
 * `undefined` means the seed is unavailable (backend slow/down at request
 * time) — the widget keeps its client-fetched loading behavior. `null` means
 * the fetch succeeded and nothing is playing.
 */
export async function fetchNowPlayingSeed(): Promise<
  FlowsheetEntry | null | undefined
> {
  const raw = await fetchBackendSeed<FlowsheetV2EntryJSON | null>(
    "/flowsheet/latest",
  );
  if (raw === undefined) return undefined;
  return raw ? convertV2Entry(raw) : null;
}

/**
 * Who-is-on-air summary for seeding the public NowPlaying widget. `undefined`
 * means the seed is unavailable and the widget keeps its client-fetched
 * loading behavior.
 */
export async function fetchWhoIsLiveSeed(): Promise<OnAirDJData | undefined> {
  const raw = await fetchBackendSeed<OnAirDJResponse[] | null>(
    "/flowsheet/djs-on-air",
  );
  if (raw === undefined) return undefined;
  return convertDJsOnAir(raw ?? undefined);
}
