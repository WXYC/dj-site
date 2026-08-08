"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  FormControl,
  FormLabel,
  Stack,
  Switch,
  Textarea,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useUpdateAlbumMutation } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { DISCOGS_UNAVAILABLE_NOTE_MAX_LENGTH } from "@/lib/features/catalog/constants";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

interface DiscogsUnavailableControlProps {
  album: AlbumEntry;
}

/**
 * MD+ control for the "Not on Discogs" flag: flips `discogsUnavailable` and
 * an optional free-text reason via `PATCH /library/:id`. Mount with
 * `key={album.id}` from the caller — local state is seeded from `album` on
 * mount only, so switching albums without a remount would leak the prior
 * album's draft note.
 */
function DiscogsUnavailableControl({ album }: DiscogsUnavailableControlProps) {
  const [updateAlbum] = useUpdateAlbumMutation();

  const [flag, setFlag] = useState(album.discogsUnavailable ?? false);
  const [flagPending, setFlagPending] = useState(false);
  const [note, setNote] = useState(album.discogsUnavailableNote ?? "");
  const [savedNote, setSavedNote] = useState(album.discogsUnavailableNote ?? "");
  const [notePending, setNotePending] = useState(false);

  const noteChanged = note.trim() !== (savedNote ?? "").trim();

  const handleFlagChange = async (next: boolean) => {
    const previousFlag = flag;
    const previousNote = savedNote;
    // The backend CHECK constraint requires the note to be null whenever the
    // flag is false, so turning the flag off clears the note in the same
    // request rather than leaving an orphaned note server-side.
    const nextNote = next ? (savedNote || null) : null;

    setFlag(next);
    setFlagPending(true);
    if (!next) {
      setNote("");
      setSavedNote("");
    }

    try {
      await updateAlbum({
        albumId: album.id,
        body: { discogsUnavailable: next, discogsUnavailableNote: nextNote },
      }).unwrap();
    } catch (err) {
      setFlag(previousFlag);
      setSavedNote(previousNote);
      setNote(previousNote);
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to update Discogs availability");
      }
    } finally {
      setFlagPending(false);
    }
  };

  const handleSaveNote = async () => {
    const trimmed = note.trim();
    const nextNote = trimmed.length > 0 ? trimmed : null;

    setNotePending(true);
    try {
      await updateAlbum({
        albumId: album.id,
        body: { discogsUnavailable: true, discogsUnavailableNote: nextNote },
      }).unwrap();
      setSavedNote(nextNote ?? "");
      setNote(nextNote ?? "");
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to save note");
      }
    } finally {
      setNotePending(false);
    }
  };

  return (
    <RequireMD>
      <Stack spacing={1}>
        <FormControl
          orientation="horizontal"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <FormLabel>Not on Discogs</FormLabel>
          <Switch
            checked={flag}
            disabled={flagPending}
            onChange={(e) => handleFlagChange(e.target.checked)}
          />
        </FormControl>
        {flag && (
          <FormControl>
            <FormLabel>Reason (optional)</FormLabel>
            <Textarea
              value={note}
              minRows={2}
              maxRows={4}
              placeholder='e.g. "embargoed until 2026-09-01" or "audience doesn&apos;t use Discogs"'
              slotProps={{
                textarea: { maxLength: DISCOGS_UNAVAILABLE_NOTE_MAX_LENGTH },
              }}
              onChange={(e) => setNote(e.target.value)}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {note.length}/{DISCOGS_UNAVAILABLE_NOTE_MAX_LENGTH}
              </Typography>
              {noteChanged && (
                <Button size="sm" loading={notePending} onClick={handleSaveNote}>
                  Save
                </Button>
              )}
            </Stack>
          </FormControl>
        )}
      </Stack>
    </RequireMD>
  );
}

export default DiscogsUnavailableControl;
