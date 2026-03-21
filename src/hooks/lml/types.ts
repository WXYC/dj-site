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
};

export type LmlLibrarySearchResponse = {
  results: LmlLibraryItem[];
  total: number;
  query: string | null;
};
