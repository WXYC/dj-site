import "server-only";

import type { PlaylistSearchResult } from "@wxyc/shared";
import { fetchBackendSeed } from "../server-fetch";
import type { PlaylistSearchResponseWithCursor } from "./api";

export type RecentPlaylistsSeed = {
  results: PlaylistSearchResult[];
};

// The empty-query "recent playlists" listing is canonical, request-time-knowable
// data requiring no auth — the same first page the client's infinite query
// requests (sort date/desc, limit 50). Server-rendering it puts populated rows
// in the initial HTML; the client query takes over once it mounts. On failure
// this returns an empty seed and the client query fills the table.
export async function fetchRecentPlaylistsSeed(): Promise<RecentPlaylistsSeed> {
  const params = new URLSearchParams({
    q: "",
    page: "0",
    limit: "50",
    sort: "date",
    order: "desc",
  });
  const raw = await fetchBackendSeed<PlaylistSearchResponseWithCursor | null>(
    `/flowsheet/search?${params.toString()}`,
  );
  return {
    results: raw?.results ?? [],
  };
}
