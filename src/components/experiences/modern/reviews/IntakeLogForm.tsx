"use client";

import { useId, useState } from "react";
import { Autocomplete, AutocompleteOption, Button, CircularProgress, FormControl, FormHelperText, FormLabel, Input, Option, Radio, RadioGroup, Select, Sheet, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useGetFormatsQuery, useLazyGetDiscogsPrefillQuery, useSearchLibraryArtistsQuery } from "@/lib/features/catalog/api";
import { discogsPrefillErrorMessage, discogsReleaseIdFrom } from "@/lib/features/catalog/discogsPrefill";
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

type Arrival = "disc" | "files";

/** A label id and the label name it belongs to: the id is sent only while the label field still holds that name. */
type LabelPick = { id: number; name: string };

/**
 * A Discogs lookup and the trimmed field text it was for, with its line once it has an answer. It lives in the
 * form so that one update can check it is still the current lookup and fill the fields; editing the field away
 * from its text, or resetting the form, drops it.
 */
type DiscogsLookup = { text: string; line: { text: string; failed: boolean } | null };

type IntakeForm = {
  artist: string;
  album: string;
  label: string;
  labelPick: LabelPick | null;
  formatId: number | null;
  arrival: Arrival | null;
  discogs: string;
  lookup: DiscogsLookup | null;
};

const EMPTY_FORM: IntakeForm = { artist: "", album: "", label: "", labelPick: null, formatId: null, arrival: null, discogs: "", lookup: null };

// The arrival choice is drawn as a segmented control: each option is a segment the whole of
// which picks it, and the picked one is raised.
const SEGMENT_RADIO_PROPS = {
  disableIcon: true,
  overlay: true,
  color: "neutral",
  variant: "plain",
  slotProps: {
    action: ({ checked }: { checked?: boolean }) => ({
      sx: checked ? { bgcolor: "background.surface", boxShadow: "sm", "&:hover": { bgcolor: "background.surface" } } : {},
    }),
  },
} as const;
const SEGMENT_SX = { px: 2, py: 1, bgcolor: "transparent", display: "flex", flexDirection: "column", justifyContent: "center" } as const;

type IntakeLogFormProps = {
  /** Called with the answered record once it has been added, never when the add fails. */
  onLogged?: (item: IntakeItem) => void;
  /** Called with true when an add is sent and with false when it ends, whichever way, so a host can hold itself open meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  /** Leaves out the form's own heading, for a host that titles it; the form keeps its accessible name. */
  hideTitle?: boolean;
  /** Puts focus on the form's first field when it mounts. */
  autoFocus?: boolean;
};

export default function IntakeLogForm({ onLogged, onBusyChange, hideTitle = false, autoFocus = false }: IntakeLogFormProps = {}) {
  const { data: formats } = useGetFormatsQuery(undefined);
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  // The text the user typed, as opposed to text set by picking a row or resetting the form.
  // Only typed text is searched, so picking a name does not trigger a second search for it.
  const [typedArtist, setTypedArtist] = useState("");
  const filesHintId = useId();
  const [fetchPrefill] = useLazyGetDiscogsPrefillQuery();

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

  // An empty Discogs field is fine; anything it cannot read as a release id keeps the form from sending.
  const discogsId = discogsReleaseIdFrom(form.discogs);
  const discogsRefused = form.discogs.trim() !== "" && discogsId == null;
  const prefilling = form.lookup != null && form.lookup.line == null;
  const prefillLine = form.lookup?.line ?? null;
  const labelId = form.labelPick != null && form.labelPick.name === form.label.trim() ? form.labelPick.id : null;

  // A disc or a record needs its format; files never have one.
  const ready =
    !discogsRefused &&
    Boolean(form.artist && form.album) &&
    (form.arrival === "files" || (form.arrival === "disc" && form.formatId != null));

  // Fills only the fields still empty, so text the music director typed is never overwritten. A paste is
  // followed by a blur on the same text, so a text already looked up, or being looked up, is not asked again;
  // a failed one is, so leaving the field retries it.
  const fillFromDiscogs = async (raw: string) => {
    const text = raw.trim();
    if (discogsReleaseIdFrom(text) == null) {
      return;
    }
    if (form.lookup?.text === text && form.lookup.line?.failed !== true) {
      return;
    }
    const lookup: DiscogsLookup = { text, line: null };
    setForm((f) => (f.discogs.trim() === text ? { ...f, lookup } : f));
    // An answer counts only while its lookup is still the form's: one for a link since replaced, cleared,
    // or sent with the record changes nothing.
    const answer = (fill: (f: IntakeForm) => IntakeForm) => setForm((f) => (f.lookup === lookup ? fill(f) : f));
    try {
      const prefill = await fetchPrefill(text).unwrap();
      if (prefill == null) {
        throw new Error("empty prefill");
      }
      answer((f) => ({
        ...f,
        artist: f.artist || prefill.artist_name,
        album: f.album || prefill.album_title,
        ...(!f.label &&
          prefill.label && {
            label: prefill.label,
            labelPick: prefill.label_id == null ? null : { id: prefill.label_id, name: prefill.label.trim() },
          }),
        lookup: { text, line: { text: COPY.discogsFilled, failed: false } },
      }));
    } catch (error) {
      answer((f) => ({ ...f, lookup: { text, line: { text: discogsPrefillErrorMessage(error), failed: true } } }));
    }
  };

  const submit = async () => {
    onBusyChange?.(true);
    let item: IntakeItem;
    try {
      item = await logItem({
        artist_name: form.artist,
        album_title: form.album,
        // `ready` guarantees a format whenever the arrival is a disc or a record.
        ...(form.arrival === "files" ? { digital: true } : { format_id: form.formatId! }),
        ...(form.label && { record_label: form.label }),
        ...(labelId != null && { label_id: labelId }),
        ...(discogsId != null && { discogs_release_id: discogsId }),
      }).unwrap();
    } catch {
      toast.error(REVIEW_COPY.screen.writeFailed);
      return;
    } finally {
      onBusyChange?.(false);
    }
    setForm(EMPTY_FORM);
    setTypedArtist("");
    onLogged?.(item);
  };

  return (
    <form
      aria-label={COPY.logTitle}
      onSubmit={(e) => {
        e.preventDefault();
        // The disabled button is not the only way to submit; a refused Discogs field must never be dropped silently.
        if (!ready) {
          return;
        }
        void submit();
      }}
    >
      {!hideTitle && <Typography component="h3" level="title-lg">{COPY.logTitle}</Typography>}
      <Stack spacing={1}>
        <FormControl error={discogsRefused || prefillLine?.failed === true}>
          <FormLabel>{COPY.discogsReleaseId}</FormLabel>
          <Input
            autoFocus={autoFocus}
            slotProps={{ input: { inputMode: "numeric" } }}
            value={form.discogs}
            onChange={(e) => {
              const discogs = e.target.value;
              setForm((f) => ({ ...f, discogs, lookup: f.lookup?.text === discogs.trim() ? f.lookup : null }));
              // The field's value after the paste, not the clipboard's text: a paste can land beside text
              // already there, or over part of it.
              if ((e.nativeEvent as InputEvent).inputType === "insertFromPaste") {
                void fillFromDiscogs(discogs);
              }
            }}
            onBlur={(e) => void fillFromDiscogs(e.target.value)}
            endDecorator={prefilling && <CircularProgress size="sm" aria-label={COPY.discogsFilling} />}
          />
          {discogsRefused && <FormHelperText>{COPY.discogsRefused}</FormHelperText>}
          {!discogsRefused && prefillLine && <FormHelperText role="status">{prefillLine.text}</FormHelperText>}
        </FormControl>
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
            onSelect={(l) => setForm((f) => ({ ...f, labelPick: { id: l.id, name: l.label_name.trim() } }))}
            onSelectionCleared={() => setForm((f) => ({ ...f, labelPick: null }))}
          />
        </FormControl>
        <FormControl required>
          <FormLabel>{COPY.arrival}</FormLabel>
          <RadioGroup
            aria-required="true"
            orientation="horizontal"
            value={form.arrival ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, arrival: e.target.value as Arrival, formatId: null }))}
            sx={{ alignSelf: "flex-start", p: 0.5, gap: 0.5, borderRadius: "md", bgcolor: "neutral.softBg", "--Radio-actionRadius": "8px" }}
          >
            <Sheet sx={SEGMENT_SX}>
              <Radio value="disc" label={COPY.arrivedAsDisc} {...SEGMENT_RADIO_PROPS} />
            </Sheet>
            <Sheet sx={SEGMENT_SX}>
              <Radio
                value="files"
                label={COPY.arrivedAsFiles}
                {...SEGMENT_RADIO_PROPS}
                slotProps={{ ...SEGMENT_RADIO_PROPS.slotProps, input: { "aria-describedby": filesHintId } }}
              />
              {/* Above the raised segment, as the option's own label is. */}
              <Typography id={filesHintId} level="body-xs" sx={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
                {COPY.arrivedAsFilesHint}
              </Typography>
            </Sheet>
          </RadioGroup>
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
        <Button type="submit" loading={logging} disabled={!ready}>{COPY.log}</Button>
      </Stack>
    </form>
  );
}
