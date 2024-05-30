export type BBinEntry = {
    dj_id: number;
    album_id: number;
    track_title: string;
};

export type BBinResult = {
    album_id: number;
    album_title: string;
    artist_name: string;
    label: string;
    code_letters: string;
    code_artist_number: number;
    code_number: number;
    format_name: string;
    genre_name: string;
};