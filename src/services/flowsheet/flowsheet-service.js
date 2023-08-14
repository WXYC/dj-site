import { getter, setter } from "../api-service";

export const getNowPlayingFromBackend = () => getter('flowsheet/latest')();

export const getFlowsheetFromBackend = (page = 0, limit = 50) => getter('flowsheet')({
    page: page,
    limit: limit
});

export const joinBackend = (show_name = '', specialty_id = null) => setter('flowsheet/join')({
    dj_id: sessionStorage.getItem('djId'),
    show_name,
    specialty_id
});

export const leaveBackend = () => setter('flowsheet/end')({
    show_id: Number(sessionStorage.getItem('showId'))
});

export const sendMessageToBackend = (message) => setter('flowsheet')({
    show_id: sessionStorage.getItem('showId'),
    message: message
});

export const addSongToBackend = (song) => setter('flowsheet')({
    show_id: sessionStorage.getItem('showId'),
    artist_name: song?.artist ?? '',
    album_title: song?.album ?? '',
    track_title: song?.title ?? '',
    record_label: song?.label ?? '',
});