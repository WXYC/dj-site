import { CatalogResult, Format, Genre, Rotation } from "@/lib/redux";
import { BRotationResult, BSearchResult } from "./backend-types";

export function convertRotationResult(backend: BRotationResult): CatalogResult {
    return {
        id: backend.id,
        album: {
            release: backend.code_number,
            title: backend.album_title,
            format: convertFormat(backend.format_name),
            artist: {
                name: backend.artist_name,
                genre: convertGenre(backend.genre_name),
                numbercode: backend.code_artist_number,
                lettercode: backend.code_letters
            },
            label: backend.record_label,
            rotation: convertRotationId(backend.rotation_id),
        }
    };
}

export function convertSearchResult(backend: BSearchResult): CatalogResult {
    return {
        id: backend.id,
        album: {
            release: backend.code_number,
            title: backend.album_title,
            format: convertFormat(backend.format_name),
            artist: {
                name: backend.artist_name,
                genre: convertGenre(backend.genre_name),
                numbercode: backend.code_artist_number,
                lettercode: backend.code_letters
            },
            rotation: convertRotation(backend.rotation_freq),
        }
    };

}

export function convertFormat(backend: string): Format {
    if (backend.includes('cd')) {
        return 'CD';
    } else if (backend.includes('vinyl')) {
        return 'Vinyl';
    } else {
        return 'Unknown';
    }
}

export function convertGenre(backend: string): Genre {
    return backend as Genre ?? 'Unknown';
}

export function convertRotationId(backend: number | undefined): Rotation | undefined {
    if (!backend) return undefined;
    return ['H', 'M', 'L', 'S'][backend] as Rotation;
}

export function convertRotation(backend: string): Rotation | undefined {
    return backend as Rotation ?? undefined;
}