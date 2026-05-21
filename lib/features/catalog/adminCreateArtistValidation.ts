import type { AdminCreateArtistFieldKey } from "./types";

/** Empty or non-numeric strings must not become 0 (Number("") === 0). */
export function parseRequiredPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function adminCreateArtistFieldValid(
  field: AdminCreateArtistFieldKey,
  values: {
    codeLetters: string;
    codeNumber: string;
    newArtistName: string;
    genreId: string;
  }
): boolean {
  switch (field) {
    case "codeLetters":
      return values.codeLetters.trim().length > 0;
    case "codeNumber":
      return parseRequiredPositiveInt(values.codeNumber) !== null;
    case "newArtistName":
      return values.newArtistName.trim().length > 0;
    case "genreSelected":
      return parseRequiredPositiveInt(values.genreId) !== null;
    default:
      return false;
  }
}
