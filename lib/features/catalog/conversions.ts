import { Album, AlbumQueryResponse } from "./types";

export function convertAlbumFromSearch(response: AlbumQueryResponse): Album {
    return {
        id: response.id,
        title: response.album_title,
        artist: {
            name: response.artist_name,
            code: response.code_artist_number,
            genre: {
                name: response.genre_name,
                id: response.id,
                code: response.code_letters,
            },
            id: response.id,
        },
        entry: response.code_number,
        format: response.format_name,
        alternate_artist: "",
        play_freq: response.play_freq,
    }
}