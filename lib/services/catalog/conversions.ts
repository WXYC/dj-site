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
        lettercode: backend.code_letters,
      },
      label: backend.record_label,
      rotation: (backend.play_freq as Rotation) ?? undefined,
    },
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
        lettercode: backend.code_letters,
      },
      rotation: (backend.rotation_freq as Rotation) ?? undefined,
    },
  };
}

export function convertFormat(backend: string): Format {
  if (backend.includes("cd")) {
    return "CD";
  } else if (backend.includes("vinyl")) {
    return "Vinyl";
  } else {
    return "Unknown";
  }
}

export function convertGenre(backend: string): Genre {
  return (backend as Genre) ?? "Unknown";
}

export function convertRotation(backend: string): Rotation | undefined {
  return (backend as Rotation) ?? undefined;
}
