export type QueryParams = {
    page: number;
    limit: number;
    start_id: number;
    end_id: number;
};

interface IFSEntry extends FSEntry {
    rotation_play_freq: string | null;
}

export type FSEntryRequestBody = {
    artist_name: string;
    album_title: string;
    track_title: string;
    album_id ? : number;
    rotation_id ? : number;
    record_label: string;
    request_flag ? : boolean;
    message ? : string;
};

export type UpdateRequestBody = {
    artist_name ? : string;
    album_title ? : string;
    track_title ? : string;
    record_label ? : string;
    request_flag ? : boolean;
    message ? : string;
};


export type JoinRequestBody = {
    dj_id: number;
    show_name ? : string;
    specialty_id ? : number;
};

export type FSEntry = {
    id: number;
    artist_name: string | null;
    album_title: string | null;
    album_id: number | null;
    show_id: number | null;
    rotation_id: number | null;
    track_title: string | null;
    record_label: string | null;
    play_order: number;
    request_flag: boolean;
    message: string | null;
};