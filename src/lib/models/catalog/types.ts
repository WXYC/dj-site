export type CatalogEntry = {
    id: number;
    code_letters: string;
    code_artist_number: number;
    code_number: number;
    artist_name: string;
    album_title: string;
    format_name: string;
    genre_name: string;
    rotation_freq: string;
    add_date: string;
}

export type SearchParameters = {
    artist_name: string;
    album_title: string;
}