"use client";

import { useState } from "react";
import { Autocomplete, AutocompleteOption, Button, FormControl, FormLabel, Input, Option, Select, Stack, Typography } from "@mui/joy";
import { toast } from "sonner";
import { useGetFormatsQuery, useSearchLibraryArtistsQuery } from "@/lib/features/catalog/api";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import type { ArtistSearchMatch } from "@/lib/features/catalog/types";
import { useLogIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import LabelSearchTypeahead from "../catalog/AddRelease/LabelSearchTypeahead";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const DIGITAL = "digital";

const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_MIN_LENGTH = 2;
const SUGGESTION_LIMIT = 8;
const NO_SUGGESTIONS: ArtistSearchMatch[] = [];

const EMPTY_FORM = { artist: "", album: "", label: "", labelId: null as number | null, formatId: null as number | null, digital: false, discogs: "" };

export default function IntakeLogForm() {
  const { data: formats } = useGetFormatsQuery(undefined);
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [form, setForm] = useState(EMPTY_FORM);

  // A failed or slow search leaves `data` undefined, which renders no options;
  // the typed text is what gets sent either way.
  const debouncedArtist = useDebouncedValue(form.artist.trim(), SUGGESTION_DEBOUNCE_MS);
  const { data: suggestions } = useSearchLibraryArtistsQuery(
    { q: debouncedArtist, limit: SUGGESTION_LIMIT },
    { skip: debouncedArtist.length < SUGGESTION_MIN_LENGTH },
  );

  const submit = async () => {
    try {
      await logItem({
        artist_name: form.artist,
        album_title: form.album,
        ...(form.digital ? { digital: true } : { format_id: form.formatId! }),
        ...(form.label && { record_label: form.label }),
        ...(form.labelId != null && { label_id: form.labelId }),
        ...(form.discogs && { discogs_release_id: Number(form.discogs) }),
      }).unwrap();
      setForm(EMPTY_FORM);
    } catch {
      toast.error(REVIEW_COPY.screen.writeFailed);
    }
  };

  return (
    <form
      aria-label={COPY.logTitle}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Typography component="h3" level="title-lg">{COPY.logTitle}</Typography>
      <Stack spacing={1}>
        <FormControl required>
          <FormLabel>{COPY.artist}</FormLabel>
          <Autocomplete<ArtistSearchMatch, false, false, true>
            freeSolo
            options={suggestions?.artists ?? NO_SUGGESTIONS}
            filterOptions={(options) => options}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.artist_name)}
            inputValue={form.artist}
            onInputChange={(_e, artist) => setForm((f) => ({ ...f, artist }))}
            renderOption={(props, option) => (
              <AutocompleteOption {...props} key={`${option.id}-${option.genre_id}`}>
                <Typography level="body-md">{option.artist_name}</Typography>
                <Typography level="body-sm" sx={{ ml: "auto" }}>{option.genre_name}</Typography>
              </AutocompleteOption>
            )}
          />
        </FormControl>
        <FormControl required>
          <FormLabel>{COPY.album}</FormLabel>
          <Input value={form.album} onChange={(e) => setForm((f) => ({ ...f, album: e.target.value }))} />
        </FormControl>
        <FormControl>
          <FormLabel>{COPY.label}</FormLabel>
          <LabelSearchTypeahead
            size="md"
            placeholder=""
            value={form.label}
            onChange={(label) => setForm((f) => ({ ...f, label }))}
            onSelect={(l) => setForm((f) => ({ ...f, labelId: l.id }))}
            onSelectionCleared={() => setForm((f) => ({ ...f, labelId: null }))}
          />
        </FormControl>
        <FormControl required>
          <FormLabel>{COPY.format}</FormLabel>
          <Select<number | string>
            value={form.digital ? DIGITAL : form.formatId}
            onChange={(_e, choice) => setForm((f) => ({ ...f, digital: choice === DIGITAL, formatId: choice === DIGITAL ? null : (choice as number | null) }))}
          >
            <Option value={DIGITAL}>{COPY.digital}</Option>
            {(formats ?? []).map((f) => (
              <Option key={f.id} value={f.id}>{formatLabel(f.format_name)}</Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>{COPY.discogsReleaseId}</FormLabel>
          <Input type="number" value={form.discogs} onChange={(e) => setForm((f) => ({ ...f, discogs: e.target.value }))} />
        </FormControl>
        <Button type="submit" loading={logging} disabled={!form.artist || !form.album || (form.formatId == null && !form.digital)}>{COPY.log}</Button>
      </Stack>
    </form>
  );
}
