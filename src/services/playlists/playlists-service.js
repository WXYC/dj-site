import { getter } from "../api-service";


export const getPlaylistsFromBackend = () => getter(
    `djs/playlists?dj_id=${sessionStorage.getItem('djId')}`
    )();

export const getPlaylistFromBackend = (playlist_id) => getter(
    `djs/playlist?playlist_id=${playlist_id}`
)();