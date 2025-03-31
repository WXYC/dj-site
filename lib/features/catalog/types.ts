export type SearchCatalogQueryParams = {
  artist_name: string | undefined;
  album_name: string | undefined;
  n: number | undefined;
};

export type AlbumParams = {
  album_title: string;
  artist_name: string | undefined;
  artist_id: string | undefined;
  label: string;
  genre_id: string;
  format_id: string;
  disc_quantity: number | undefined;
  alternate_artist_name: string | undefined;
};

export type AlbumRequestParams = {
  album_id: number;
};

export type ArtistParams = {
  artist_name: string;
  code_letters: string;
  genre_id: string;
};

export type RotationParams = {
  album_id: string;
  play_freq: Rotation;
};

export type KillRotationParams = {
  rotation_id: number;
  kill_date: Date | undefined;
};

export type AlbumQueryResponse = {
  id: number;
  add_date: string;
  album_dist: number | undefined;
  album_title: string;
  artist_dist: number | undefined;
  artist_name: string;
  code_artist_number: number;
  code_letters: string;
  code_number: number;
  format_name: string;
  genre_name: string;
  label: string;
  play_freq: Rotation | undefined;
  plays: number | undefined;
  rotation_id: number | undefined;
};

export type AlbumEntry = {
  id: number;
  title: string;
  artist: ArtistEntry;
  entry: number;
  format: Format;
  alternate_artist: string | undefined;
  play_freq: Rotation | undefined;
  rotation_id: number | undefined;
  plays: number | undefined;
  add_date: string | undefined;
  label: string;
};

export type ArtistEntry = {
  name: string;
  lettercode: string;
  numbercode: number;
  genre: Genre;
  id: number | undefined;
};

export enum Rotation {
  S = "S",
  L = "L",
  M = "M",
  H = "H",
}

export type CatalogFrontendState = {
  search: CatalogSearchState;
  results: CatalogResultsState;
};

export type CatalogSearchState = {
  query: string;
  in: SearchIn;
  genre: Genre | "All";
  mobileOpen: boolean;
  params: {
    n: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  };
};

export type CatalogResultsState = {
  selected: number[];
};

export type SearchIn = "Artists" | "Albums" | "Both";

export type Format = "Vinyl" | "CD" | "Unknown";

export type Genre =
  | "Blues"
  | "Rock"
  | "Electronic"
  | "Hiphop"
  | "Jazz"
  | "Classical"
  | "Reggae"
  | "Soundtracks"
  | "OCS"
  | "Unknown";
