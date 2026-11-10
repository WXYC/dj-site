"use client";

import { useId, useState } from "react";
import { Button, CircularProgress, FormControl, FormHelperText, FormLabel, Input, Radio, radioClasses, RadioGroup, Sheet, Stack, Typography } from "@mui/joy";
import type { IntakeItem } from "@wxyc/shared";
import { toast } from "sonner";
import { useLazyGetDiscogsPrefillQuery } from "@/lib/features/catalog/api";
import { discogsPrefillErrorMessage, discogsReleaseIdFrom } from "@/lib/features/catalog/discogsPrefill";
import { bandcampUrlFrom } from "@/lib/features/reviews/bandcampLink";
import { useLogIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import type { CiteTarget } from "@/lib/features/reviews/paths";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { useReviewProbablyExists } from "@/src/hooks/useReviewProbablyExists";
import { REVIEW_COPY } from "./copy";
import { AlbumField, ArtistField, BandcampField, FormatField, LabelField } from "./IntakeFields";
import ReviewHint from "./ReviewHint";

const COPY = REVIEW_COPY.intake;

const SUGGESTION_DEBOUNCE_MS = 300;

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
  bandcamp: string;
  lookup: DiscogsLookup | null;
};

const EMPTY_FORM: IntakeForm = { artist: "", album: "", label: "", labelPick: null, formatId: null, arrival: null, discogs: "", bandcamp: "", lookup: null };

// The arrival choice is drawn as a segmented control: each option is a segment the whole of
// which picks it, and the picked one is raised. Tab lands on an option without picking it, and Joy
// would ring that whole segment, which reads as picked; so the track takes the ring and the focused
// option's label is underlined.
const SEGMENT_RADIO_PROPS = {
  disableIcon: true,
  overlay: true,
  color: "neutral",
  variant: "plain",
  sx: {
    [`& .${radioClasses.action}.${radioClasses.focusVisible}`]: { outline: "none" },
    [`&.${radioClasses.focusVisible} .${radioClasses.label}`]: { textDecoration: "underline" },
  },
  slotProps: {
    action: ({ checked }: { checked?: boolean }) => ({
      sx: checked ? { bgcolor: "background.surface", boxShadow: "sm", "&:hover": { bgcolor: "background.surface" } } : {},
    }),
  },
} as const;
const SEGMENT_SX = { px: 2, py: 1, bgcolor: "transparent", display: "flex", flexDirection: "column", justifyContent: "center" } as const;

type IntakeLogFormProps = {
  /** Called with the answered record once it has been added, never when the add fails. `cite` is set only when the record was added with the one-step button, naming the review the host should open to choose. */
  onLogged?: (item: IntakeItem, cite?: CiteTarget) => void;
  /** Called with true when an add is sent and with false when it ends, whichever way, so a host can hold itself open meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  /** Leaves out the form's own heading, for a host that titles it; the form keeps its accessible name. */
  hideTitle?: boolean;
  /** Puts focus on the form's first field when it mounts. */
  autoFocus?: boolean;
};

export default function IntakeLogForm({ onLogged, onBusyChange, hideTitle = false, autoFocus = false }: IntakeLogFormProps = {}) {
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const filesHintId = useId();
  const [fetchPrefill] = useLazyGetDiscogsPrefillQuery();

  // The hint and the one-step button follow the debounced text and wait until the fields hold it, and until
  // both reads for it have ended: they answer on their own, so the target is not read from half an answer.
  const [artist, album] = [form.artist.trim(), form.album.trim()];
  const debouncedArtist = useDebouncedValue(artist, SUGGESTION_DEBOUNCE_MS);
  const debouncedAlbum = useDebouncedValue(album, SUGGESTION_DEBOUNCE_MS);
  const textSettled = artist !== "" && album !== "" && artist === debouncedArtist && album === debouncedAlbum;
  const { library, formCount, settled: readsSettled } = useReviewProbablyExists(debouncedArtist, debouncedAlbum, textSettled);
  const cite: CiteTarget | null = !textSettled || !readsSettled ? null : library ? { kind: "library", albumId: library.id } : formCount > 0 ? { kind: "form" } : null;

  // An empty Discogs field is fine; anything it cannot read as a release id keeps the form from sending.
  const discogsId = discogsReleaseIdFrom(form.discogs);
  const discogsRefused = form.discogs.trim() !== "" && discogsId == null;
  const bandcampLink = bandcampUrlFrom(form.bandcamp);
  const bandcampRefused = bandcampLink === "refused";
  const prefilling = form.lookup != null && form.lookup.line == null;
  const prefillLine = form.lookup?.line ?? null;
  const labelId = form.labelPick != null && form.labelPick.name === form.label.trim() ? form.labelPick.id : null;

  // A disc or a record needs its format; files never have one.
  const ready =
    !discogsRefused &&
    !bandcampRefused &&
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
        // The label comes by name only, sent as `record_label` text with no `label_id`; it is matched to a
        // labels row later, when the item is filed. Only a pick from the label dropdown carries a WXYC label id.
        ...(!f.label && prefill.label && { label: prefill.label, labelPick: null }),
        lookup: { text, line: { text: COPY.discogsFilled, failed: false } },
      }));
    } catch (error) {
      answer((f) => ({ ...f, lookup: { text, line: { text: discogsPrefillErrorMessage(error), failed: true } } }));
    }
  };

  const submit = async (withCite: boolean) => {
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
        ...(bandcampLink != null && { bandcamp_url: bandcampLink }),
      }).unwrap();
    } catch {
      toast.error(REVIEW_COPY.screen.writeFailed);
      return;
    } finally {
      onBusyChange?.(false);
    }
    setForm(EMPTY_FORM);
    onLogged?.(item, withCite && cite ? cite : undefined);
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
        void submit(false);
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
        <BandcampField value={form.bandcamp} refused={bandcampRefused} onChange={(bandcamp) => setForm((f) => ({ ...f, bandcamp }))} />
        <ArtistField value={form.artist} onChange={(artist) => setForm((f) => ({ ...f, artist }))} />
        <AlbumField value={form.album} onChange={(album) => setForm((f) => ({ ...f, album }))} />
        <LabelField
          value={form.label}
          onChange={(label) => setForm((f) => ({ ...f, label }))}
          onSelect={(l) => setForm((f) => ({ ...f, labelPick: { id: l.id, name: l.label_name.trim() } }))}
          onSelectionCleared={() => setForm((f) => ({ ...f, labelPick: null }))}
        />
        <FormControl required>
          <FormLabel>{COPY.arrival}</FormLabel>
          <RadioGroup
            aria-required="true"
            orientation="horizontal"
            value={form.arrival ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, arrival: e.target.value as Arrival, formatId: null }))}
            sx={(theme) => ({
              alignSelf: "flex-start",
              p: 0.5,
              gap: 0.5,
              borderRadius: "md",
              bgcolor: "neutral.softBg",
              "--Radio-actionRadius": "8px",
              // Drawn inside the track: the dialog's content clips anything past its edge.
              [`&:has(.${radioClasses.focusVisible})`]: { ...theme.focus.default, outlineOffset: `calc(-1 * ${theme.vars.focus.thickness})` },
            })}
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
        {form.arrival === "disc" && <FormatField value={form.formatId} onChange={(formatId) => setForm((f) => ({ ...f, formatId }))} />}
        {/* Mounted while empty so a hint that appears is announced, whole. */}
        <div role="status" aria-atomic="true">{cite && <ReviewHint artist={debouncedArtist} album={debouncedAlbum} />}</div>
        <Button type="submit" loading={logging} disabled={!ready}>{COPY.log}</Button>
        {cite && (
          <Button type="button" variant="outlined" loading={logging} disabled={!ready} onClick={() => void submit(true)}>{COPY.addAndChoose}</Button>
        )}
      </Stack>
    </form>
  );
}
