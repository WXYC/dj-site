export type BackendGenre = {
    id: number;
    description: string | null;
    add_date: string;
    last_modified: Date;
    genre_name: string;
    plays: number;
};

export type BackendReview = {
    id: number;
    add_date: string;
    last_modified: Date;
    album_id: number;
    review: string | null;
    author: string | null;
};

export type BackendBinEntry = {
    id: number;
    album_id: number;
    track_title: string | null;
    dj_id: number;
};

export type BackendShow = {
    id: number;
    start_time: Date;
    specialty_id: number | null;
    primary_dj_id: number | null;
    show_name: string | null;
    end_time: Date | null;
};

export type ShowDJ = {
    show_id: number;
    dj_id: number;
    active: boolean | null;
};

export type SpecialtyShows = {
    id: number;
    specialty_name: string;
    description: string | null;
    add_date: string;
    last_modified: Date;
};