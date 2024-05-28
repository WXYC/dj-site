import { OrderByOption, OrderDirectionOption, SearchInOption } from "@/app/components/Table/types";
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
    genre: Genre | "All";
    orderBy: OrderByOption;
    orderDirection: OrderDirectionOption;
    noResultsRemain: boolean;
};

export interface CatalogResult {
    id: number;
    album: Album;
    reviews?: Review[];
};

export interface Review {
    username: string;
    content: string;
    recommends?: number[];
};