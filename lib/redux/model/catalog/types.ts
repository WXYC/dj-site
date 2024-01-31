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

export type SearchInOption = "All" | "Albums" | "Artists";
export type OrderByOption = "Artist" | "Title" | "Code" | "Format" | "Plays";
export type OrderDirectionOption = "asc" | "desc";

export interface CatalogResult {
    id: number;
    album: Album;
};