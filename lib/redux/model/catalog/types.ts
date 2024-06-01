import { OrderByOption, OrderDirectionOption, SearchInOption } from "@/app/components/Table/types";
import { Album, Genre, ProposedAlbum } from "../types";

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

export interface CatalogResult extends CatalogResultProps {
    id: number;
};

export interface CatalogResultProps {
    album: Album;
    reviews?: Review[];
}

export interface CatalogEntryProps {
    album?: ProposedAlbum;
}

export interface Review {
    username: string;
    content: string;
    recommends?: number[];
};