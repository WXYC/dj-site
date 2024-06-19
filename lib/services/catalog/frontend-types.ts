import { SearchInOption } from "@/app/components/Table/types";
import { CatalogResult, Genre, Rotation } from "@/lib/redux";

export interface SearchParameters {
    term: string;
    medium: SearchInOption;
    genre: Genre | "All";
    n: number;
    rotation?: CatalogResult[];
  };

export interface RotationQueryParameters {
    album_id: number;
    play_freq: Rotation;
}