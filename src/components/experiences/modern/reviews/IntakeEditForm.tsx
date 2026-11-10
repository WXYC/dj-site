"use client";

import { useState } from "react";
import { Button, Stack } from "@mui/joy";
import type { IntakeItem, IntakeItemPatch } from "@wxyc/shared";
import { bandcampUrlFrom } from "@/lib/features/reviews/bandcampLink";
import { REVIEW_COPY } from "./copy";
import { AlbumField, ArtistField, BandcampField, FormatField, LabelField } from "./IntakeFields";

/** A label id and the label name it belongs to: the id is sent only while the label field still holds that name. */
type LabelPick = { id: number; name: string };

/** The form's values. */
type Values = { artist: string; album: string; label: string; pick: LabelPick | null; formatId: number | null; bandcamp: string };

/** True when the typed Bandcamp text is the stored link: the same text, or text the backend stores as it (`new URL(value).href`). */
function isStoredLink(text: string, stored: string | null | undefined): boolean {
  const trimmed = text.trim();
  if (trimmed === (stored ?? "")) {
    return true;
  }
  try {
    return stored != null && new URL(trimmed).href === stored;
  } catch {
    return false;
  }
}

/**
 * What the Bandcamp field holds, checked only once the person has changed it: an unchanged stored link is never
 * re-validated or sent, since the backend keeps links found on custom domains that `bandcampUrlFrom` refuses.
 */
function bandcampEdit(text: string, stored: string | null | undefined): { changed: boolean; value: string | null | "refused" } {
  if (isStoredLink(text, stored)) {
    return { changed: false, value: stored ?? null };
  }
  return { changed: true, value: bandcampUrlFrom(text) };
}

/**
 * The patch that takes `opening` (the item as the form opened on it) to the form's values: only the fields that
 * changed, so an unchanged form is `{}`. Null when a field holds something the backend would refuse.
 */
function changesTo(opening: IntakeItem, v: Values): IntakeItemPatch | null {
  const bandcamp = bandcampEdit(v.bandcamp, opening.bandcamp_url);
  const [artist, album, label] = [v.artist.trim(), v.album.trim(), v.label.trim()];
  if (bandcamp.value === "refused" || !artist || !album) {
    return null;
  }
  const labelId = v.pick?.name === label ? v.pick.id : null;
  const labelChanged = label !== (opening.record_label ?? "") || (labelId != null && labelId !== opening.label_id);
  return {
    ...(artist !== opening.artist_name && { artist_name: artist }),
    ...(album !== opening.album_title && { album_title: album }),
    // PATCH keeps an omitted field, so a changed label always says which row it belongs to, or none.
    ...(labelChanged && (label ? { record_label: label, label_id: labelId } : { record_label: null, label_id: null })),
    ...(!opening.digital && v.formatId != null && v.formatId !== opening.format_id && { format_id: v.formatId }),
    ...(bandcamp.changed && { bandcamp_url: bandcamp.value }),
  };
}

/** The log-onto-shelf form's fields, prefilled from an unfiled record; Save sends only what changed. */
export default function IntakeEditForm({ item, saving, onSave, onCancel }: { item: IntakeItem; saving: boolean; onSave: (patch: IntakeItemPatch) => void; onCancel: () => void }) {
  // The item as the form opened on it: a refetch while the form is open must not move what the patch is measured against.
  const [opening] = useState(item);
  const [artist, setArtist] = useState(opening.artist_name);
  const [album, setAlbum] = useState(opening.album_title);
  const [label, setLabel] = useState(opening.record_label ?? "");
  const [pick, setPick] = useState<LabelPick | null>(opening.label_id != null && opening.record_label ? { id: opening.label_id, name: opening.record_label.trim() } : null);
  const [formatId, setFormatId] = useState<number | null>(opening.format_id);
  const [bandcamp, setBandcamp] = useState(opening.bandcamp_url ?? "");
  const patch = changesTo(opening, { artist, album, label, pick, formatId, bandcamp });
  const changed = patch !== null && Object.keys(patch).length > 0;

  return (
    <form
      aria-label={REVIEW_COPY.intakeItem.edit}
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) {
          onSave(patch);
        }
      }}
    >
      <Stack spacing={1}>
        <ArtistField value={artist} onChange={setArtist} />
        <AlbumField value={album} onChange={setAlbum} />
        <LabelField
          value={label}
          onChange={setLabel}
          onSelect={(l) => setPick({ id: l.id, name: l.label_name.trim() })}
          onSelectionCleared={() => setPick(null)}
        />
        {!opening.digital && <FormatField value={formatId} onChange={setFormatId} />}
        <BandcampField value={bandcamp} refused={bandcampEdit(bandcamp, opening.bandcamp_url).value === "refused"} onChange={setBandcamp} />
        <Stack direction="row" spacing={1}>
          <Button type="submit" loading={saving} disabled={!changed}>{REVIEW_COPY.save}</Button>
          <Button type="button" variant="plain" color="neutral" onClick={onCancel}>{REVIEW_COPY.cancel}</Button>
        </Stack>
      </Stack>
    </form>
  );
}
