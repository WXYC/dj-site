export type QueryParams = {
    page: number;
    limit: number;
    start_id: number;
    end_id: number;
};

interface IFSEntry extends FSEntry {
    rotation_play_freq: string | null | undefined;
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
    artist_name: string | null | undefined;
    album_title: string | null | undefined;
    album_id: number | null | undefined;
    show_id: number | null | undefined;
    rotation_id: number | null | undefined;
    track_title: string | null | undefined;
    record_label: string | null | undefined;
    play_order: number;
    request_flag: boolean;
    message: string | null | undefined;
};