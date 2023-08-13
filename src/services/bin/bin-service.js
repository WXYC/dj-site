import { deleter, getter, setter } from "../api-service";


export const addToBinBackend = (id) => setter(`djs/bin`)({
    dj_id: sessionStorage.getItem('djId'),
    album_id: id
});
export const removeFromBinBackend = (id) => deleter(`djs/bin`)({
    dj_id: sessionStorage.getItem('djId'),
    album_id: id
});

export const loadFromBinBackend = () => getter(`djs/bin?dj_id=${sessionStorage.getItem('djId')}`)();