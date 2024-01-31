import { Album, Genre } from "../types";

export interface AlbumCard {
    album: Album;
}

export interface CatalogState {
    query: string;
    loading: boolean;
    results: CatalogResult[];
    resultCount: number;
    searchIn: SearchInOption;
    genre: Genre | "any";
    orderBy: OrderByOption;
    orderDirection: OrderDirectionOption;
    noResultsRemain: boolean;
};

export type SearchInOption = "albums" | "artists" | "any";
export type OrderByOption = "artist" | "album" | "plays" | "genre";
export type OrderDirectionOption = "asc" | "desc";

export interface CatalogResult {
    id: number;
    album: Album;
};