import { BackendGenre, Genre } from "../redux";

export function convert(backend: BackendGenre): Genre {
    return backend.genre_name as Genre;
}