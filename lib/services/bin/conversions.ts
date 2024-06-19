import { CatalogResult, Format } from "@/lib/redux";
import { BBinResult } from "./types";
import { convertFormat, convertGenre } from "../catalog/conversions";

export const convertBinResult = (result: BBinResult): CatalogResult => ({
    id: result.album_id,
    album: {
        release: result.code_number,
        title: result.album_title,
        format: convertFormat(result.format_name),
        artist: {
            name: result.artist_name,
            genre: convertGenre(result.genre_name),
            numbercode: result.code_artist_number,
            lettercode: result.code_letters
        }
    },
    reviews: undefined
});