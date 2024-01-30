import { Song } from '../../redux/model/types';
import { deleter, getter, setter, updater } from "../api-service";

export const getNowPlayingFromBackend = () => getter('flowsheet/latest')();

export const getOnAirFromBackend = () => getter(`flowsheet/on-air?dj_id=${sessionStorage.getItem('djId')}`)();

export const getDJListFromBackend = () => getter('flowsheet/djs-on-air')();

export const getFlowsheetFromBackend = (page = 0, limit = 50) => getter(`flowsheet?limit=${limit}&page=${page}`)();

export const joinBackend = (show_name = '', specialty_id = null) => setter('flowsheet/join')({
    dj_id: sessionStorage.getItem('djId'),
    show_name,
    specialty_id
});

export const leaveBackend = () => setter('flowsheet/end')({
    dj_id: sessionStorage.getItem('djId')
});

export const sendMessageToBackend = (message: string) => setter('flowsheet')({
    message: message
});

export const addSongToBackend = (song: Song) => setter('flowsheet')({
    artist_name: song?.album?.artist.name ?? '',
    album_title: song?.album?.title ?? '',
    track_title: song?.title ?? '',
    record_label: song?.album?.label ?? '',
    rotation_id: song?.album?.rotation ?? null,
});

export const removeFromFlowsheetBackend = (id: number) => deleter(`flowsheet`)({
    entry_id: id,
});

/*
export const updateFlowsheetEntryOnBackend = (id: number, quality, value) => updater(`flowsheet`)({
    entry_id: id,
    [quality]: value,
});
*/