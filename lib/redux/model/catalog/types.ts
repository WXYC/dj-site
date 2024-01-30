import { Album } from "../types";

export interface AlbumCard {
    album: Album;
}

export interface CatalogState {
    query: string;
    results: CatalogResult[];
};

export interface CatalogResult {
    id: number;
    album: Album;
};