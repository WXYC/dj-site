import { User } from "../..";
import { Song } from "../types";

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
    rotation_freq?: string;
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
    title: string;
    artist: FlowsheetArtist;
}

export interface FlowsheetArtist {
    name: string;
}