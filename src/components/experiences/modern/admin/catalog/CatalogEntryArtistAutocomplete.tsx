"use client";

import { useLazySearchArtistsInGenreQuery } from "@/lib/features/catalog/api";
import Autocomplete from "@mui/joy/Autocomplete";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import {
  type ArtistAutocompleteOption,
  filterArtistAutocompleteOptions,
  getArtistOptionLabel,
  toExistingOption,
} from "./catalogEntryArtistOptions";
import { useEffect, useMemo, useState } from "react";

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

type CatalogEntryArtistAutocompleteProps = {
  genreIdNum: number | null;
  disabled?: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  value: ArtistAutocompleteOption | null;
  onSelectExisting: (artist: {
    id: number;
    artist_name: string;
    code_letters: string;
    code_number: number;
  }) => void;
  onSelectNew: (name: string) => void;
  onClear: () => void;
};

export default function CatalogEntryArtistAutocomplete({
  genreIdNum,
  disabled,
  inputValue,
  onInputChange,
  value,
  onSelectExisting,
  onSelectNew,
  onClear,
}: CatalogEntryArtistAutocompleteProps) {
  const [searchTrigger, { data, isFetching }] =
    useLazySearchArtistsInGenreQuery();
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(inputValue.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    if (genreIdNum === null || debouncedQ.length < MIN_SEARCH_LENGTH) {
      return;
    }
    searchTrigger({ genre_id: genreIdNum, q: debouncedQ, limit: 10 });
  }, [genreIdNum, debouncedQ, searchTrigger]);

  const baseOptions = useMemo((): ArtistAutocompleteOption[] => {
    return (data?.artists ?? []).map(toExistingOption);
  }, [data?.artists]);

  const genreReady = genreIdNum !== null;

  return (
    <FormControl required disabled={!genreReady || disabled}>
      <FormLabel>Artist</FormLabel>
      <Autocomplete
        freeSolo
        disabled={!genreReady || disabled}
        placeholder={
          genreReady ? "Search or add an artist" : "Choose a genre first"
        }
        options={baseOptions}
        loading={isFetching}
        inputValue={inputValue}
        onInputChange={(_e, newValue) => onInputChange(newValue)}
        value={value}
        filterOptions={(options, params) =>
          filterArtistAutocompleteOptions(options, params)
        }
        getOptionLabel={getArtistOptionLabel}
        isOptionEqualToValue={(a, b) => {
          if (a.type !== b.type) return false;
          if (a.type === "create" && b.type === "create") {
            return a.inputValue === b.inputValue;
          }
          if (a.type === "existing" && b.type === "existing") {
            return a.id === b.id;
          }
          return false;
        }}
        onChange={(_e, newValue) => {
          if (!newValue) {
            onClear();
            return;
          }
          if (typeof newValue === "string") {
            const name = newValue.trim();
            if (name) onSelectNew(name);
            return;
          }
          if (newValue.type === "create") {
            onSelectNew(newValue.inputValue.trim());
            return;
          }
          onSelectExisting(newValue);
        }}
        slotProps={{
          input: {
            "aria-label": "Artist name",
          },
        }}
      />
      {!genreReady && (
        <FormHelperText>
          Select a genre to search artists in that section.
        </FormHelperText>
      )}
    </FormControl>
  );
}
