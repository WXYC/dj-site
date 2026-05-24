"use client";

import { useLazySearchArtistsInGenreQuery } from "@/lib/features/catalog/api";
import Add from "@mui/icons-material/Add";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Typography from "@mui/joy/Typography";
import type { HTMLAttributes, Key } from "react";
import {
  type ArtistAutocompleteOption,
  filterArtistAutocompleteOptions,
  getArtistOptionLabel,
  toExistingOption,
} from "./catalogEntryArtistOptions";
import { useEffect, useMemo, useState } from "react";

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

type ArtistOptionRenderProps = HTMLAttributes<HTMLLIElement> & { key?: Key };

function renderArtistOption(
  props: ArtistOptionRenderProps,
  option: ArtistAutocompleteOption
) {
  const { key, ...optionProps } = props;
  if (option.type === "create") {
    return (
      <AutocompleteOption key={key} {...optionProps} color="primary" variant="soft">
        <ListItemDecorator sx={{ minInlineSize: 24 }}>
          <Add fontSize="small" />
        </ListItemDecorator>
        <ListItemContent>{getArtistOptionLabel(option)}</ListItemContent>
      </AutocompleteOption>
    );
  }
  return (
    <AutocompleteOption key={key} {...optionProps}>
      <ListItemContent
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <span>{option.artist_name}</span>
        <Typography level="body-xs" textColor="neutral.500" sx={{ flexShrink: 0 }}>
          {option.code_letters} {option.code_number}
        </Typography>
      </ListItemContent>
    </AutocompleteOption>
  );
}

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
  allowCreateArtist?: boolean;
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
  allowCreateArtist = true,
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
  const queryReady = debouncedQ.length >= MIN_SEARCH_LENGTH;
  const noOptionsText = !genreReady
    ? "Choose a genre first"
    : !queryReady
      ? "Type at least 2 characters to search"
      : isFetching
        ? "Searching…"
        : "No matching artists — use Add to create a new one";

  return (
    <FormControl required disabled={!genreReady || disabled}>
      <FormLabel>Artist</FormLabel>
      <Autocomplete
        freeSolo
        selectOnFocus
        clearOnBlur
        handleHomeEndKeys
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
          allowCreateArtist
            ? filterArtistAutocompleteOptions(options, params)
            : filterArtistAutocompleteOptions(options, params).filter(
                (o) => o.type === "existing"
              )
        }
        getOptionLabel={getArtistOptionLabel}
        getOptionKey={(option) =>
          option.type === "existing" ? option.id : `create-${option.inputValue}`
        }
        noOptionsText={noOptionsText}
        renderOption={renderArtistOption}
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
            if (!allowCreateArtist) return;
            const name = newValue.trim();
            if (name) onSelectNew(name);
            return;
          }
          if (newValue.type === "create") {
            if (!allowCreateArtist) return;
            onSelectNew(newValue.inputValue.trim());
            return;
          }
          onSelectExisting(newValue);
        }}
        slotProps={{
          input: {
            "aria-label": "Artist name",
            autoComplete: "new-password",
          },
          listbox: {
            sx: {
              py: 0.5,
              "--ListItem-paddingX": "12px",
            },
          },
        }}
      />
      <FormHelperText>
        {!genreReady
          ? "Select a genre to search artists in that section."
          : "Matches artists already in this genre; pick Add to create a new code."}
      </FormHelperText>
    </FormControl>
  );
}
