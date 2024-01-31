import { CatalogResult } from "./catalog";
import { Rotation } from "./rotation";

// APP STATE
export interface ApplicationState {
    enableClassicView: boolean;
    classicView: boolean;
    popupContent?: JSX.Element;
    songCardContent?: CatalogResult;
    popupOpen: boolean;
    songCardOpen: boolean;
};

// GLOBAL CONCEPTS
export interface Song {
    title: string;
    album?: Album;
};

export interface Album {
    release: number;
    title: string;
    format: Format;
    artist: Artist;
    alternate_artist?: Artist;
    entry: number;
    label?: string;
    rotation?: Rotation;
};

export interface Artist {
    name: string;
    genre: Genre;
    numbercode: number;
    lettercode: string;
};

export type Format = "Vinyl" | "CD";

export type Genre = "Rock" | "Electronic" | "Hiphop" | "Jazz" | "Classical" | "Reggae" | "Soundtracks" | "OCS";