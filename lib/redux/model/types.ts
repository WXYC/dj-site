import { CatalogResult } from "./catalog";
import { FlowsheetAlbum, FlowsheetArtist } from "./flowsheet";
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
    album?: Album | FlowsheetAlbum;
};

export interface Album {
    release: number;
    title: string;
    format: Format;
    artist: Artist | FlowsheetArtist;
    alternate_artist?: Artist | FlowsheetArtist;
    label?: string;
    rotation?: Rotation;
};

export interface Artist {
    name: string;
    genre: Genre;
    numbercode: number;
    lettercode: string;
};

export type Format = "Vinyl" | "CD" | "Unknown";

export type Genre = "Blues" | "Rock" | "Electronic" | "Hiphop" | "Jazz" | "Classical" | "Reggae" | "Soundtracks" | "OCS" | "Unknown";

export type Tuple<T> = [T, T];