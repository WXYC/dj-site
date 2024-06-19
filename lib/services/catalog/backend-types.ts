export type BRotationResult = {
    id: number;
    code_letters: string;
    code_artist_number: number;
    code_number: number;
    artist_name: string;
    album_title: string;
    record_label: string;
    genre_name: string;
    format_name: string;
    rotation_id: number;
    add_date: string;
    play_freq: string;
    kill_date?: string;
    plays: number;
};

export type BSearchResult = {
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
};