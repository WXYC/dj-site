"use client";

import { useState } from "react";
import { Button, Stack } from "@mui/joy";
import type { IntakeItem, IntakeItemPatch } from "@wxyc/shared";
import { bandcampUrlFrom } from "@/lib/features/reviews/bandcampLink";
import { REVIEW_COPY } from "./copy";
import { AlbumField, ArtistField, BandcampField, FormatField, LabelField } from "./IntakeFields";

/** A label id and the label name it belongs to: the id is sent only while the label field still holds that name. */
type LabelPick = { id: number; name: string };

/**
 * The patch that takes `item` to the form's values: only the fields that changed, so an unchanged form is `{}`.
 * Null when a field holds something the backend would refuse.
 */
function changesTo(item: IntakeItem, v: { artist: string; album: string; label: string; pick: LabelPick | null; formatId: number | null; bandcamp: string }): IntakeItemPatch | null {
  const bandcamp = bandcampUrlFrom(v.bandcamp);
  const [artist, album, label] = [v.artist.trim(), v.album.trim(), v.label.trim()];
  if (bandcamp === "refused" || !artist || !album) {
    return null;
  }
  const labelId = v.pick?.name === label ? v.pick.id : null;
  const labelChanged = label !== (item.record_label ?? "") || (labelId != null && labelId !== item.label_id);
  return {
    ...(artist !== item.artist_name && { artist_name: artist }),
    ...(album !== item.album_title && { album_title: album }),
    ...(labelChanged && (label ? { record_label: label, ...(labelId != null && { label_id: labelId }) } : { record_label: null, label_id: null })),
    ...(!item.digital && v.formatId != null && v.formatId !== item.format_id && { format_id: v.formatId }),
    ...(v.bandcamp.trim() !== (item.bandcamp_url ?? "") && { bandcamp_url: bandcamp }),
  };
}

/** The log-onto-shelf form's fields, prefilled from an unfiled record; Save sends only what changed. */
export default function IntakeEditForm({ item, saving, onSave, onCancel }: { item: IntakeItem; saving: boolean; onSave: (patch: IntakeItemPatch) => void; onCancel: () => void }) {
  const [artist, setArtist] = useState(item.artist_name);
  const [album, setAlbum] = useState(item.album_title);
  const [label, setLabel] = useState(item.record_label ?? "");
  const [pick, setPick] = useState<LabelPick | null>(item.label_id != null && item.record_label ? { id: item.label_id, name: item.record_label.trim() } : null);
  const [formatId, setFormatId] = useState<number | null>(item.format_id);
  const [bandcamp, setBandcamp] = useState(item.bandcamp_url ?? "");
  const patch = changesTo(item, { artist, album, label, pick, formatId, bandcamp });
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
        {!item.digital && <FormatField value={formatId} onChange={setFormatId} />}
        <BandcampField value={bandcamp} refused={bandcampUrlFrom(bandcamp) === "refused"} onChange={setBandcamp} />
        <Stack direction="row" spacing={1}>
          <Button type="submit" loading={saving} disabled={!changed}>{REVIEW_COPY.save}</Button>
          <Button type="button" variant="plain" color="neutral" onClick={onCancel}>{REVIEW_COPY.cancel}</Button>
        </Stack>
      </Stack>
    </form>
  );
}
