import { toast } from "sonner";
import { deleter, getter, setter } from "../api-service";


export const addToBinBackend = (id) => setter(`djs/bin`)({
    dj_id: sessionStorage.getItem('djId'),
    album_id: id
});
export const removeFromBinBackend = (id) => deleter(`djs/bin?dj_id=${sessionStorage.getItem('djId')}&album_id=${id}`)();

const loadFromBinBackend = () => getter(`djs/bin?dj_id=${sessionStorage.getItem('djId')}`)();

export const loadBin = async () => {
    const { data, error } = await loadFromBinBackend();

    if (error) {
        toast.error("Could not load your bin!");
        console.error(error);
        return [];
    }

    if (data) {
        console.log(data);
        return data.map((item) => ({
            id: item.album_id ?? -1,
            artist: {
                genre: item.genre_name ?? '',
                lettercode: item.code_letters ?? '',
                numbercode: item.code_artist_number ?? -1,
                name: item.artist_name ?? ''
            },
            release_number: item.code_number ?? -1,
            title: item.album_title ?? '',
            format: item.format_name ?? '',
            alternate_artist: '',
            label: item.label ?? '',
        }));
    } else return [];
}