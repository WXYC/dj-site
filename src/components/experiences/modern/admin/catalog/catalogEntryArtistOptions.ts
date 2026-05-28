import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { createFilterOptions } from "@mui/joy/Autocomplete";

export type ArtistAutocompleteExisting = ArtistInGenreOption & {
  type: "existing";
};

/** @deprecated Use ArtistAutocompleteExisting — kept as alias for form state. */
export type ArtistAutocompleteOption = ArtistAutocompleteExisting;

const filter = createFilterOptions<ArtistAutocompleteExisting>();

export function toExistingOption(
  artist: ArtistInGenreOption
): ArtistAutocompleteExisting {
  return { type: "existing", ...artist };
}

export function getArtistOptionLabel(option: ArtistAutocompleteExisting): string {
  return option.artist_name;
}

export function filterArtistAutocompleteOptions(
  options: ArtistAutocompleteExisting[],
  params: { inputValue: string }
): ArtistAutocompleteExisting[] {
  return filter(options, {
    ...params,
    getOptionLabel: getArtistOptionLabel,
  });
}

export function findExactArtistMatch(
  options: ArtistAutocompleteExisting[],
  inputValue: string
): ArtistAutocompleteExisting | null {
  const trimmed = inputValue.trim();
  if (!trimmed) return null;
  return (
    options.find(
      (o) => o.artist_name.toLowerCase() === trimmed.toLowerCase()
    ) ?? null
  );
}

export type CommitArtistInputResult =
  | { kind: "clear" }
  | { kind: "noop" }
  | {
      kind: "existing";
      artist: {
        id: number;
        artist_name: string;
        code_letters: string;
        code_number: number;
      };
    }
  | { kind: "new"; name: string };

export function resolveArtistInputCommit(
  inputValue: string,
  options: ArtistAutocompleteExisting[],
  allowCreateArtist: boolean
): CommitArtistInputResult {
  const trimmed = inputValue.trim();
  if (!trimmed) return { kind: "clear" };

  const exact = findExactArtistMatch(options, trimmed);
  if (exact) {
    return {
      kind: "existing",
      artist: {
        id: exact.id,
        artist_name: exact.artist_name,
        code_letters: exact.code_letters,
        code_number: exact.code_number,
      },
    };
  }

  if (allowCreateArtist) {
    return { kind: "new", name: trimmed };
  }

  return { kind: "noop" };
}

export function defaultLettersFromName(name: string): string {
  const t = name.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return "";
}
