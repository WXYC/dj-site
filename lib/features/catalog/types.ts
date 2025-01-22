export type SearchCatalogQueryParams = {
  artist_name: string | undefined;
  album_name: string | undefined;
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
}

export type AlbumRequestParams = {
    album_id: string;
}

export type ArtistParams = {
    artist_name: string;
    code_letters: string;
    genre_id: string;
}

export type RotationParams = {
    album_id: string;
    play_freq: Frequency;
}

export type KillRotationParams = {
    rotation_id: number;
    kill_date: Date | undefined;
}

export type AlbumQueryResponse = {
    id: number;
    add_date: Date;
    album_dist: number | undefined;
    album_title: string;
    artist_dist: number | undefined;
    artist_name: string;
    code_artist_number: number;
    code_letters: string;
    code_number: number;
    format_name: string;
    genre_name: string;
    label: string;
    play_freq: Frequency | undefined;
}

export type Album = {
    id: number;
    title: string;
    artist: Artist;
    entry: number;
    format: string;
    alternate_artist: string | undefined;
    play_freq: Frequency | undefined;
}

export type Artist = {
    name: string;
    code: number;
    genre: Genre;
    id: number;
}

export type Genre = {
    name: string;
    id: number;
    code: string;
}

export enum Frequency {
    S = "S",
    L = "L",
    M = "M",
    H = "H",
}
