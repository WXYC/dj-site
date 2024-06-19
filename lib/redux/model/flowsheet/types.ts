import { Rotation, User } from "../..";
import { Album, Format, Song } from "../types";

/* Types */
export interface FlowSheetState {
    live: boolean;
    changingAir: boolean;
    loading: boolean;
    entries: FlowSheetEntry[];
    entryPlaceholderIndex: number;
    entryClientRect?: EntryRectProps;
    queue: FlowSheetEntry[];
    queuePlaceholderIndex: number;
    autoplay: boolean;
    editDepth: number;
    timer?: SongTimer;
};

export interface SongTimer {
    length: Time;
    remaining: Time;
};

export interface Time {
    hour: number;
    minute: number;
    second: number;
    total: number;
};

export interface FlowSheetEntry extends FlowSheetEntryProps {
    id: number;
};

export interface FlowSheetEntryProps {
    message?: string;
    song?: Song;
    request?: boolean;
    rotation_freq?: Rotation;
    catalog_id?: number;
};

export interface Show {
    id: number;
    dj?: User;
};

export interface EntryRectProps {
    x: number;
    y: number;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
};

export interface FlowsheetAlbum {
    release: number;
    title: string;
    artist: FlowsheetArtist;
    alternate_artist?: FlowsheetArtist;
    label?: string;
}

export interface FlowsheetArtist {
    name: string;
}