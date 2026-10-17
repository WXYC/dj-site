"use client";

import { useState } from "react";
import { Autocomplete, AutocompleteOption, Button, FormControl, FormLabel, Input, Option, Radio, RadioGroup, Select, Stack, Typography } from "@mui/joy";
import { toast } from "sonner";
import { useGetFormatsQuery, useSearchLibraryArtistsQuery } from "@/lib/features/catalog/api";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import type { ArtistSearchMatch } from "@/lib/features/catalog/types";
import { useLogIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import LabelSearchTypeahead from "../catalog/AddRelease/LabelSearchTypeahead";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_MIN_LENGTH = 2;
const SUGGESTION_LIMIT = 8;
const NO_SUGGESTIONS: ArtistSearchMatch[] = [];

const EMPTY_FORM = { artist: "", album: "", label: "", labelId: null as number | null, formatId: null as number | null, arrival: null as "disc" | "files" | null, discogs: "" };

export default function IntakeLogForm() {
  const { data: formats } = useGetFormatsQuery(undefined);
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [form, setForm] = useState(EMPTY_FORM);
  // The text the user typed, as opposed to text set by picking a row or resetting the form.
  // Only typed text is searched, so picking a name does not trigger a second search for it.
  const [typedArtist, setTypedArtist] = useState("");

  // `currentData` is undefined while the search for the current term is pending or has
  // failed, whereas `data` would keep the rows of an earlier term. Options also stay hidden
  // until the debounce has caught up with the typed text and the text is long enough to search.
  const typedTerm = typedArtist.trim();
  const debouncedTerm = useDebouncedValue(typedTerm, SUGGESTION_DEBOUNCE_MS);
  const { currentData: suggestions } = useSearchLibraryArtistsQuery(
    { q: debouncedTerm, limit: SUGGESTION_LIMIT },
    { skip: debouncedTerm.length < SUGGESTION_MIN_LENGTH },
  );
  const showSuggestions = typedTerm.length >= SUGGESTION_MIN_LENGTH && typedTerm === debouncedTerm;

  const submit = async () => {
    try {
      await logItem({
        artist_name: form.artist,
        album_title: form.album,
        ...(form.arrival === "files" ? { digital: true } : { format_id: form.formatId! }),
        ...(form.label && { record_label: form.label }),
        ...(form.labelId != null && { label_id: form.labelId }),
        ...(form.discogs && { discogs_release_id: Number(form.discogs) }),
      }).unwrap();
      setForm(EMPTY_FORM);
      setTypedArtist("");
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
          <Autocomplete<ArtistSearchMatch, false, true, true>
            freeSolo
            // The input text is the only value: no picked option is kept, so nothing survives a form reset.
            value=""
            disableClearable
            options={showSuggestions ? (suggestions?.artists ?? NO_SUGGESTIONS) : NO_SUGGESTIONS}
            filterOptions={(options) => options}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.artist_name)}
            getOptionKey={(option) => (typeof option === "string" ? option : `${option.id}-${option.genre_id}`)}
            inputValue={form.artist}
            onInputChange={(_e, artist, reason) => {
              setForm((f) => ({ ...f, artist }));
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
          <FormLabel>{COPY.arrival}</FormLabel>
          <RadioGroup
            orientation="horizontal"
            value={form.arrival ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, arrival: e.target.value as "disc" | "files", formatId: null }))}
          >
            <Radio value="disc" label={COPY.arrivedAsDisc} />
            <Radio value="files" label={COPY.arrivedAsFiles} />
          </RadioGroup>
          {form.arrival === "files" && <Typography level="body-sm">{COPY.arrivedAsFilesHint}</Typography>}
        </FormControl>
        {form.arrival === "disc" && (
          <FormControl required>
            <FormLabel>{COPY.format}</FormLabel>
            <Select<number>
              value={form.formatId}
              onChange={(_e, choice) => setForm((f) => ({ ...f, formatId: choice }))}
            >
              {(formats ?? []).map((f) => (
                <Option key={f.id} value={f.id}>{formatLabel(f.format_name)}</Option>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl>
          <FormLabel>{COPY.discogsReleaseId}</FormLabel>
          <Input type="number" value={form.discogs} onChange={(e) => setForm((f) => ({ ...f, discogs: e.target.value }))} />
        </FormControl>
        <Button type="submit" loading={logging} disabled={!form.artist || !form.album || (form.arrival == null || (form.arrival === "disc" && form.formatId == null))}>{COPY.log}</Button>
      </Stack>
    </form>
  );
}
