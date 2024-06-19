import { deleter, getter, setter } from "../api-service";

export const getBinFromBackend = (dj_id: number) => 
    getter(`djs/bin?dj_id=${dj_id}`)();

export const addToBinBackend = (album_id: number, dj_id: number) => 
    setter("djs/bin")({
        album_id,
        dj_id
    });

export const removeFromBinBackend = (album_id: number, dj_id: number) => 
    deleter(`djs/bin?dj_id=${dj_id}&album_id=${album_id}`)();