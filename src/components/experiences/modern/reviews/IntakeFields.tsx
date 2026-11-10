"use client";

import { useState } from "react";
import { Autocomplete, AutocompleteOption, FormControl, FormHelperText, FormLabel, Input, Option, Select, Typography } from "@mui/joy";
import { useGetFormatsQuery, useSearchLibraryArtistsQuery } from "@/lib/features/catalog/api";
import type { ArtistSearchMatch } from "@/lib/features/catalog/types";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import LabelSearchTypeahead, { type LabelSearchTypeaheadProps } from "../catalog/AddRelease/LabelSearchTypeahead";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_MIN_LENGTH = 2;
const SUGGESTION_LIMIT = 8;
const NO_SUGGESTIONS: ArtistSearchMatch[] = [];

/** The artist field, with library artists suggested as the person types. The text is the only value: no picked option is kept. */
export function ArtistField({ value, onChange }: { value: string; onChange: (artist: string) => void }) {
  // The text the user typed, as opposed to text set by picking a row or by the host. Only typed text is
  // searched, so picking a name does not trigger a second search for it.
  const [typedArtist, setTypedArtist] = useState("");
  // `currentData` is undefined while the search for the current term is pending or has failed, whereas `data`
  // would keep the rows of an earlier term. Options also stay hidden until the debounce has caught up with the
  // typed text and the text is long enough to search.
  const typedTerm = typedArtist === value ? value.trim() : "";
  const debouncedTerm = useDebouncedValue(typedTerm, SUGGESTION_DEBOUNCE_MS);
  const { currentData: suggestions } = useSearchLibraryArtistsQuery(
    { q: debouncedTerm, limit: SUGGESTION_LIMIT },
    { skip: debouncedTerm.length < SUGGESTION_MIN_LENGTH },
  );
  const showSuggestions = typedTerm.length >= SUGGESTION_MIN_LENGTH && typedTerm === debouncedTerm;

  return (
    <FormControl required>
      <FormLabel>{COPY.artist}</FormLabel>
      <Autocomplete<ArtistSearchMatch, false, true, true>
        freeSolo
        // Held at the input text, so a prefilled artist is not reset to empty when the field mounts.
        value={value}
        disableClearable
        options={showSuggestions ? (suggestions?.artists ?? NO_SUGGESTIONS) : NO_SUGGESTIONS}
        filterOptions={(options) => options}
        getOptionLabel={(option) => (typeof option === "string" ? option : option.artist_name)}
        getOptionKey={(option) => (typeof option === "string" ? option : `${option.id}-${option.genre_id}`)}
        inputValue={value}
        onInputChange={(_e, artist, reason) => {
          onChange(artist);
          setTypedArtist(reason === "input" ? artist : "");
        }}
        renderOption={(props, option) => (
          <AutocompleteOption {...props}>
            <Typography level="body-md">{option.artist_name}</Typography>
            <Typography level="body-sm" sx={{ ml: "auto" }}>{option.genre_name}</Typography>
          </AutocompleteOption>
        )}
      />
    </FormControl>
  );
}

export function AlbumField({ value, onChange }: { value: string; onChange: (album: string) => void }) {
  return (
    <FormControl required>
      <FormLabel>{COPY.album}</FormLabel>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </FormControl>
  );
}

/** The Bandcamp link field; `refused` marks a link `bandcampUrlFrom` will not accept. */
export function BandcampField({ value, refused, onChange }: { value: string; refused: boolean; onChange: (link: string) => void }) {
  return (
    <FormControl error={refused}>
      <FormLabel>{COPY.bandcampUrl}</FormLabel>
      <Input slotProps={{ input: { inputMode: "url", "aria-invalid": refused } }} value={value} onChange={(e) => onChange(e.target.value)} />
      {refused && <FormHelperText>{COPY.bandcampRefused}</FormHelperText>}
    </FormControl>
  );
}

export function LabelField(props: Pick<LabelSearchTypeaheadProps, "value" | "onChange" | "onSelect" | "onSelectionCleared">) {
  return (
    <FormControl>
      <FormLabel>{COPY.label}</FormLabel>
      <LabelSearchTypeahead size="md" placeholder="" {...props} />
    </FormControl>
  );
}

export function FormatField({ value, onChange }: { value: number | null; onChange: (formatId: number | null) => void }) {
  const { data: formats } = useGetFormatsQuery(undefined);
  return (
    <FormControl required>
      <FormLabel>{COPY.format}</FormLabel>
      <Select<number> value={value} onChange={(_e, choice) => onChange(choice)}>
        {(formats ?? []).map((f) => (
          <Option key={f.id} value={f.id}>{formatLabel(f.format_name)}</Option>
        ))}
      </Select>
    </FormControl>
  );
}
