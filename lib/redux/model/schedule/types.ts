import { DJ } from "../admin";

export type ScheduleState = {
    events?: Show[];
    forDJ?: DJ;
}

export type Show = {
    type: ShowType;
}

export type ShowType = 'dj-shift' | 'specialty-show' | 'new-dj-shift';