import { FlowsheetAlbum } from "./flowsheet";
import { Rotation } from "./rotation";

// APP STATE
export interface ApplicationState {
  enableClassicView: boolean;
  classicView: boolean;
  popupContent?: JSX.Element;
  sideBarContent?: JSX.Element;
  sideBarOpen: boolean;
  popupOpen: boolean;
}

// GLOBAL CONCEPTS
export interface Song {
  title: string;
  album?: Album | FlowsheetAlbum;
}

export interface Album {
  release: number;
  title: string;
  format: Format;
  artist: Artist;
  alternate_artist?: Artist;
  label?: string;
  rotation?: Rotation;
}

export interface ProposedAlbum {
  release?: number;
  title?: string;
  format?: string;
  artist?: ProposedArtist;
  alternate_artist?: ProposedArtist;
  label?: string;
  rotation?: Rotation;
}

export interface Artist {
  name: string;
  genre: Genre;
  numbercode: number;
  lettercode: string;
}

export interface ProposedArtist {
  name?: string;
  genre?: string;
  numbercode?: number;
  lettercode?: string;
}

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

export type Tuple<T> = [T, T];
