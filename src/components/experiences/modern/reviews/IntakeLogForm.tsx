"use client";

import { useState } from "react";
import { Button, FormControl, FormLabel, Input, Option, Select, Stack, Typography } from "@mui/joy";
import { toast } from "sonner";
import { useGetFormatsQuery } from "@/lib/features/catalog/api";
import { formatLabel } from "@/lib/features/experiences/modern/tokens/roles";
import { useLogIntakeItemMutation } from "@/lib/features/reviews/intakeApi";
import LabelSearchTypeahead from "../catalog/AddRelease/LabelSearchTypeahead";
import { REVIEW_COPY } from "./copy";

const COPY = REVIEW_COPY.intake;

const EMPTY_FORM = { artist: "", album: "", label: "", labelId: null as number | null, formatId: null as number | null, discogs: "" };

export default function IntakeLogForm() {
  const { data: formats } = useGetFormatsQuery(undefined);
  const [logItem, { isLoading: logging }] = useLogIntakeItemMutation();
  const [form, setForm] = useState(EMPTY_FORM);

  const submit = async () => {
    try {
      await logItem({
        artist_name: form.artist,
        album_title: form.album,
        format_id: form.formatId!,
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
      <Typography level="title-lg">{COPY.logTitle}</Typography>
      <Stack spacing={1}>
        <FormControl required>
          <FormLabel>{COPY.artist}</FormLabel>
          <Input value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} />
        </FormControl>
        <FormControl required>
          <FormLabel>{COPY.album}</FormLabel>
          <Input value={form.album} onChange={(e) => setForm((f) => ({ ...f, album: e.target.value }))} />
        </FormControl>
        <FormControl>
          <FormLabel>{COPY.label}</FormLabel>
          <LabelSearchTypeahead
            value={form.label}
            onChange={(label) => setForm((f) => ({ ...f, label }))}
            onSelect={(l) => setForm((f) => ({ ...f, labelId: l.id }))}
            onSelectionCleared={() => setForm((f) => ({ ...f, labelId: null }))}
          />
        </FormControl>
        <FormControl required>
          <FormLabel>{COPY.format}</FormLabel>
          <Select value={form.formatId} onChange={(_e, formatId) => setForm((f) => ({ ...f, formatId }))}>
            {(formats ?? []).map((f) => (
              <Option key={f.id} value={f.id}>{formatLabel(f.format_name)}</Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>{COPY.discogsReleaseId}</FormLabel>
          <Input type="number" value={form.discogs} onChange={(e) => setForm((f) => ({ ...f, discogs: e.target.value }))} />
        </FormControl>
        <Button type="submit" loading={logging} disabled={!form.artist || !form.album || form.formatId == null}>{COPY.log}</Button>
      </Stack>
    </form>
  );
}
