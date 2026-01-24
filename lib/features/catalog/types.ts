import type { RotationBin, Genre, Format } from "@wxyc/shared";

// Re-export shared types
export type {
  Genre,
  Format,
  CatalogSearchParams,
  AlbumSearchResult,
  AddAlbumRequest,
  AddArtistRequest,
} from "@wxyc/shared";

// Backwards compatibility aliases
export type { CatalogSearchParams as SearchCatalogQueryParams } from "@wxyc/shared";
export type { AlbumSearchResult as AlbumQueryResponse } from "@wxyc/shared";

// Frontend-specific form types (use string IDs from form inputs)
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

// Frontend display types (transformed from API responses)
export type AlbumEntry = {
  id: number;
  title: string;
  artist: ArtistEntry;
  entry: number;
  format: Format;
  alternate_artist: string | undefined;
  rotation_bin: RotationBin | undefined;
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

// Redux state types
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
