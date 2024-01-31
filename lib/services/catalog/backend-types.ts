export type NewAlbumRequest = {
    album_title: string;
    artist_name ? : string;
    artist_id ? : number;
    alternate_artist_name ? : string;
    label: string;
    genre_id: number;
    format_id: number;
    disc_quantity ? : number;
};

export type AlbumQueryParams = {
    artist_name ? : string;
    album_title ? : string;
    code_letters ? : string;
    code_artist_number ? : string;
    code_number ? : number;
    n ? : number;
    page ? : number;
};

export type NewArtistRequest = {
    artist_name: string;
    code_letters: string;
    genre_id: number;
};

export type KillRotationRelease = {
    rotation_id: number;
    kill_date ? : string; //Accepts ISO8601 formatted dates YYYY-MM-DD
};