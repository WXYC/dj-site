import { getter, setter, updater } from "../api-service";


export const addAlbumToRotation = (album_id, play_freq) => setter('library/rotation')({
    album_id,
    play_freq
});

export const getRotationEntries = () => getter('library/rotation')();

export const getFormatsFromBackend = () => getter('library/formats')();

export const removeFromRotationBackend = (id) => updater('library/rotation')({
    rotation_id: id
});