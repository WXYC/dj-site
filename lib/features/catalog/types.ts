import type { AlbumSearchResult } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

export type { AlbumSearchResult };

/**
 * JSON boundary adapter for AlbumSearchResult.
 * RTK Query delivers raw JSON where add_date is a string, not a Date.
 */
export type AlbumSearchResultJSON = Omit<AlbumSearchResult, "add_date"> & {
  add_date: string;
};

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

export type AlbumEntry = {
  id: number;
  title: string;
  artist: ArtistEntry;
  entry: number;
  format: Format;
  alternate_artist: string | undefined;
  rotation_bin: Rotation | undefined;
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

export type SearchIn = "Artists" | "Albums" | "All";

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
