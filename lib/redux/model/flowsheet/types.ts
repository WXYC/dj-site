import { User } from "../..";
import { Song } from "../types";

/* Types */
export interface FlowSheetState {
    live: boolean;
    changingAir: boolean;
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

export interface FlowSheetEntry {
    id?: number;
    message?: string;
    song?: Song;
    request?: boolean;
    rotation_id?: number;
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