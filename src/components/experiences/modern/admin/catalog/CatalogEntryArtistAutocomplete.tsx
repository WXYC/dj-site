"use client";

import { useLazySearchArtistsInGenreQuery } from "@/lib/features/catalog/api";
import Autocomplete from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import ListItemContent from "@mui/joy/ListItemContent";
import Typography from "@mui/joy/Typography";
import type { HTMLAttributes, Key } from "react";
import {
  type ArtistAutocompleteExisting,
  filterArtistAutocompleteOptions,
  getArtistOptionLabel,
  resolveArtistInputCommit,
  toExistingOption,
} from "./catalogEntryArtistOptions";
import type { CatalogEntryArtistMode } from "./useCatalogEntryForm";
import { useCallback, useEffect, useMemo, useState } from "react";

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;

type ArtistOptionRenderProps = HTMLAttributes<HTMLLIElement> & { key?: Key };

function renderArtistOption(
  props: ArtistOptionRenderProps,
  option: ArtistAutocompleteExisting,
) {
  const { key, color: _color, ...optionProps } = props;
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
        <Typography
          level="body-xs"
          textColor="neutral.500"
          sx={{ flexShrink: 0 }}
        >
          {option.code_letters} {option.code_number}
        </Typography>
      </ListItemContent>
    </AutocompleteOption>
  );
}

function applyCommitResult(
  result: ReturnType<typeof resolveArtistInputCommit>,
  handlers: {
    onClear: () => void;
    onSelectExisting: (artist: {
      id: number;
      artist_name: string;
      code_letters: string;
      code_number: number;
    }) => void;
    onSelectNew: (name: string) => void;
  },
) {
  switch (result.kind) {
    case "clear":
      handlers.onClear();
      break;
    case "existing":
      handlers.onSelectExisting(result.artist);
      break;
    case "new":
      handlers.onSelectNew(result.name);
      break;
    case "noop":
      break;
  }
}

type CatalogEntryArtistAutocompleteProps = {
  genreIdNum: number | null;
  disabled?: boolean;
  artistMode: CatalogEntryArtistMode;
  inputValue: string;
  onInputChange: (value: string) => void;
  value: ArtistAutocompleteExisting | null;
  codeLetters: string;
  codeNumber: string;
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
  artistMode,
  inputValue,
  onInputChange,
  value,
  codeLetters,
  codeNumber,
  onSelectExisting,
  onSelectNew,
  onClear,
  allowCreateArtist = true,
}: CatalogEntryArtistAutocompleteProps) {
  const [searchTrigger, { data, isFetching }] =
    useLazySearchArtistsInGenreQuery();
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQ(inputValue.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    if (genreIdNum === null || debouncedQ.length < MIN_SEARCH_LENGTH) {
      return;
    }
    searchTrigger({ genre_id: genreIdNum, q: debouncedQ, limit: 10 });
  }, [genreIdNum, debouncedQ, searchTrigger]);

  const baseOptions = useMemo((): ArtistAutocompleteExisting[] => {
    return (data?.artists ?? []).map(toExistingOption);
  }, [data?.artists]);

  const commitInput = useCallback(
    (raw: string) => {
      applyCommitResult(
        resolveArtistInputCommit(raw, baseOptions, allowCreateArtist),
        { onClear, onSelectExisting, onSelectNew },
      );
    },
    [baseOptions, allowCreateArtist, onClear, onSelectExisting, onSelectNew],
  );

  const genreReady = genreIdNum !== null;
  const queryReady = debouncedQ.length >= MIN_SEARCH_LENGTH;
  const noOptionsText = !genreReady
    ? "Choose a genre first"
    : !queryReady
      ? "Type at least 2 characters to search"
      : isFetching
        ? "Searching…"
        : allowCreateArtist
          ? "No matching artists — press Enter or click away to add new"
          : "No matching artists in this genre";

  const autocompleteColor =
    artistMode === "existing" || artistMode === "created"
      ? "success"
      : artistMode === "new"
        ? "primary"
        : undefined;

  const statusSuffix = useMemo(() => {
    if (artistMode === "existing" || artistMode === "created") {
      const letters = codeLetters.trim();
      const num = codeNumber.trim();
      if (!letters && !num) return null;
      return (
        <Typography
          level="body-xs"
          textColor="neutral.500"
          sx={{ flexShrink: 0 }}
        >
          {letters} {num}
        </Typography>
      );
    }
    if (artistMode === "new") {
      return (
        <Typography
          level="body-xs"
          textColor="primary.500"
          sx={{ flexShrink: 0 }}
        >
          NEW
        </Typography>
      );
    }
    return null;
  }, [artistMode, codeLetters, codeNumber]);

  return (
    <FormControl required disabled={!genreReady || disabled}>
      <FormLabel>Artist</FormLabel>
      <Box sx={{ position: "relative", width: "100%" }}>
        <Autocomplete
          freeSolo
          selectOnFocus
          clearOnBlur={false}
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
          {...(autocompleteColor ? { color: autocompleteColor } : {})}
          filterOptions={filterArtistAutocompleteOptions}
          getOptionLabel={(option) =>
            typeof option === "string" ? option : getArtistOptionLabel(option)
          }
          getOptionKey={(option) =>
            typeof option === "string" ? `free-${option}` : option.id
          }
          noOptionsText={noOptionsText}
          renderOption={renderArtistOption}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_e, newValue) => {
            if (!newValue) {
              onClear();
              return;
            }
            if (typeof newValue === "string") {
              commitInput(newValue);
              return;
            }
            onSelectExisting(newValue);
          }}
          slotProps={{
            input: {
              "aria-label": "Artist name",
              autoComplete: "new-password",
              onBlur: () => commitInput(inputValue),
              ...(statusSuffix
                ? { sx: { "--Input-paddingInlineEnd": "4.5rem" } }
                : {}),
            },
            listbox: {
              sx: {
                py: 0.5,
                "--ListItem-paddingX": "12px",
              },
            },
          }}
        />
        {statusSuffix ? (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 36,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            {statusSuffix}
          </Box>
        ) : null}
      </Box>
      <FormHelperText>
        {!genreReady
          ? "Select a genre to search artists in that section."
          : allowCreateArtist
            ? "Pick a match from the list, or finish typing and press Enter to add a new artist code."
            : "Search for an artist already in this genre."}
      </FormHelperText>
    </FormControl>
  );
}
