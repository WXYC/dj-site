import type { TrackMatchHint } from "@/lib/features/catalog/types";

export type LmlLibraryItem = {
  id: number;
  title: string | null;
  artist: string | null;
  call_letters: string | null;
  artist_call_number: number | null;
  release_call_number: number | null;
  genre: string | null;
  format: string | null;
  alternate_artist_name: string | null;
  library_url: string;
  // Declared on `LibrarySearchItem` in wxyc-shared/api.yaml but not in its
  // `required` set, so optional here (see dj-site#605).
  label?: string | null;
  on_streaming?: boolean | null;
  matched_via?: TrackMatchHint[];
};

export type LmlLibrarySearchResponse = {
  results: LmlLibraryItem[];
  total: number;
  query: string | null;
};
