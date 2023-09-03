import { getter } from "../api-service";


export const getPlaylistsFromBackend = () => getter(
    `playlists?dj_id=${sessionStorage.getItem('djId')}`
    )();

export const getPlaylistFromBackend = (playlist_id) => getter(
    `playlists/playlist?playlist_id=${playlist_id}`
)();