"use client";

import { useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Stack,
  Typography,
} from "@mui/joy";
import type { SpecialtyShowRef } from "@wxyc/shared";
import { useUpdateShowMutation } from "@/lib/features/flowsheet/api";
import { showPlaylistApi } from "@/lib/features/show-playlist/api";
import { useGetSpecialtyShowsQuery } from "@/lib/features/specialty/api";
import { specialtyCopy } from "@/lib/features/specialty/copy";
import { useAppDispatch } from "@/lib/hooks";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

const NONE = "none";
const TITLE_MAX_LENGTH = 128;

/**
 * Changes an open or ended show's program and title. The caller decides whether
 * to offer it; the server refuses the rest, and its refusals are worded by the
 * update mutation, so this only shows the sentence it is handed. Mount one per
 * show (keyed) so the form starts from that show's values.
 */
export default function EditShowDetailsDialog({
  showId,
  specialty,
  showName,
  onClose,
}: {
  showId: number;
  /** The show's current program; null when it is freeform or not known. */
  specialty: Pick<SpecialtyShowRef, "id" | "name"> | null | undefined;
  showName: string | null | undefined;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const { data: catalog = [] } = useGetSpecialtyShowsQuery();
  const [updateShow, { isLoading }] = useUpdateShowMutation();
  const [choice, setChoice] = useState(specialty ? String(specialty.id) : NONE);
  const [title, setTitle] = useState(showName ?? "");
  const [refusal, setRefusal] = useState<string | null>(null);

  // A retired program is never a new choice, but it stays the current value so
  // the select can show it and the DJ can clear it.
  const programs = catalog.filter((p) => p.active || p.id === specialty?.id);
  const current = specialty && !programs.some((p) => p.id === specialty.id) ? specialty : null;

  const save = async () => {
    const body: { specialty_id?: number | null; show_name?: string | null } = {};
    const nextId = choice === NONE ? null : Number(choice);
    if (nextId !== (specialty?.id ?? null)) {
      body.specialty_id = nextId;
    }
    const nextTitle = title.trim();
    if (nextTitle !== (showName ?? "")) {
      body.show_name = nextTitle || null;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setRefusal(null);
    try {
      await updateShow({ showId, ...body }).unwrap();
      dispatch(showPlaylistApi.util.invalidateTags([{ type: "ShowPlaylist", id: showId }]));
      onClose();
    } catch (error) {
      // Null is a refusal for the site's general handling, which has toasted it.
      setRefusal((error as { sentence?: string }).sentence ?? null);
    }
  };

  return (
    <ConfirmDialog
      open
      role="dialog"
      title={specialtyCopy.editDetailsTitle}
      pending={isLoading}
      onClose={onClose}
      actions={
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button variant="plain" color="neutral" disabled={isLoading} onClick={onClose}>
            {specialtyCopy.cancel}
          </Button>
          <Button loading={isLoading} onClick={() => void save()}>
            {specialtyCopy.save}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <FormControl>
          <FormLabel>{specialtyCopy.programLabel}</FormLabel>
          <Select value={choice} onChange={(_e, value) => setChoice(value ?? NONE)}>
            <Option value={NONE}>{specialtyCopy.noneFreeform}</Option>
            {current && <Option value={String(current.id)}>{current.name}</Option>}
            {programs.map((p) => (
              <Option key={p.id} value={String(p.id)}>
                {p.name}
              </Option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>{specialtyCopy.titleLabel}</FormLabel>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            slotProps={{ input: { maxLength: TITLE_MAX_LENGTH } }}
          />
        </FormControl>
        {refusal && (
          <Typography level="body-sm" color="danger" role="alert">
            {refusal}
          </Typography>
        )}
      </Stack>
    </ConfirmDialog>
  );
}
