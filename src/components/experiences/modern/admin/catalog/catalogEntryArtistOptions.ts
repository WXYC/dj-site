import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { createFilterOptions } from "@mui/joy/Autocomplete";

export type ArtistAutocompleteExisting = ArtistInGenreOption & {
  type: "existing";
};

export type ArtistAutocompleteCreate = {
  type: "create";
  inputValue: string;
};

export type ArtistAutocompleteOption =
  | ArtistAutocompleteExisting
  | ArtistAutocompleteCreate;

const filter = createFilterOptions<ArtistAutocompleteOption>();

export function toExistingOption(
  artist: ArtistInGenreOption
): ArtistAutocompleteExisting {
  return { type: "existing", ...artist };
}

export function getArtistOptionLabel(option: ArtistAutocompleteOption): string {
  if (option.type === "create") {
    return `Add "${option.inputValue}"`;
  }
  return option.artist_name;
}

/** Appends a creatable row when the typed name is not an exact catalog match. */
export function appendCreatableArtistOption(
  options: ArtistAutocompleteOption[],
  inputValue: string
): ArtistAutocompleteOption[] {
  const input = inputValue.trim();
  if (input === "") {
    return options;
  }
  const hasExact = options.some(
    (o) =>
      o.type === "existing" &&
      o.artist_name.toLowerCase() === input.toLowerCase()
  );
  if (!hasExact) {
    return [...options, { type: "create", inputValue: input }];
  }
  return options;
}

export function filterArtistAutocompleteOptions(
  options: ArtistAutocompleteOption[],
  params: { inputValue: string }
): ArtistAutocompleteOption[] {
  const filtered = filter(options, {
    ...params,
    getOptionLabel: getArtistOptionLabel,
  });
  return appendCreatableArtistOption(filtered, params.inputValue);
}

export function defaultLettersFromName(name: string): string {
  const t = name.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return "";
}
