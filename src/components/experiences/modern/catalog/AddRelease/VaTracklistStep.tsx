"use client";

import { useState } from "react";
import { Add, Delete } from "@mui/icons-material";
import {
  Button,
  CircularProgress,
  IconButton,
  Input,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { useGetCompilationTrackSuggestionsQuery } from "@/lib/features/catalog/api";
import type { CompilationTrackInput } from "@/lib/features/catalog/types";

type DraftRow = {
  /** Stable across edits and removals, so React never reuses one row's DOM for another. */
  key: number;
  artist_name: string;
  track_title: string;
  track_position: string;
};

let nextRowKey = 0;
const blankRow = (): DraftRow => ({
  key: nextRowKey++,
  artist_name: "",
  track_title: "",
  track_position: "",
});

const rowFromSuggestion = (track: CompilationTrackInput): DraftRow => ({
  key: nextRowKey++,
  artist_name: track.artist_name,
  track_title: track.track_title ?? "",
  track_position: track.track_position ?? "",
});

/** Blank optional fields are stored as NULL, not as empty strings. */
const toInput = (row: DraftRow): CompilationTrackInput => ({
  artist_name: row.artist_name.trim(),
  track_title: row.track_title.trim() || null,
  track_position: row.track_position.trim() || null,
});

export type VaTracklistStepProps = {
  libraryId: number;
  albumTitle: string;
  onSave: (tracks: CompilationTrackInput[]) => void;
  onSkip: () => void;
  isSaving: boolean;
};

/**
 * Per-track artist capture for a Various-Artists release, shown once the
 * release itself exists. Without it a V/A add files a compilation whose tracks
 * are individually unfindable — release-level search is the only thing that
 * would ever match them.
 *
 * Only reachable from inside the add-release panel, which the MD authorization
 * gate wraps whole. That gate, not this component, is what holds the
 * suggestions read to the librarian bar the backend enforces on it — the read
 * triggers upstream Discogs work and is deliberately not a catalog-read route.
 *
 * The write behind `onSave` can only add credits, never amend or remove one, so
 * this step is correct exactly while the release it targets has no stored
 * credits yet — which is what "shown once, immediately after the release is
 * created" guarantees. Do not reuse it to edit a release that already has a
 * tracklist: each corrected row would be filed alongside the row it was meant
 * to replace, and both would stay searchable.
 */
export default function VaTracklistStep({
  libraryId,
  albumTitle,
  onSave,
  onSkip,
  isSaving,
}: VaTracklistStepProps) {
  const {
    data: suggestions,
    isLoading,
    isError,
    refetch,
  } = useGetCompilationTrackSuggestionsQuery({ libraryId });

  const [rows, setRows] = useState<DraftRow[] | null>(null);
  // Which release the current rows were seeded for. Compared during render
  // rather than synchronized in an effect: seeding is derived from the
  // suggestions response, not a subscription to anything outside React.
  const [seededFor, setSeededFor] = useState<number | null>(null);

  if (suggestions && seededFor !== libraryId) {
    setSeededFor(libraryId);
    setRows(
      suggestions.tracks.length > 0
        ? suggestions.tracks.map(rowFromSuggestion)
        : [blankRow()],
    );
  }

  // Entering manual entry from the error state is an explicit choice, not a
  // consequence of the read failing: an unreachable backend must never be able
  // to pass itself off as "Discogs matched nothing", which is the one reading
  // that costs the librarian a hand-typed tracklist.
  const startManualEntry = () => {
    setSeededFor(libraryId);
    setRows([blankRow()]);
  };

  const updateRow = (key: number, patch: Partial<DraftRow>) =>
    setRows((current) =>
      (current ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const removeRow = (key: number) =>
    setRows((current) => (current ?? []).filter((row) => row.key !== key));

  const addRow = () => setRows((current) => [...(current ?? []), blankRow()]);

  const handleSave = () => {
    // A row whose artist is blank carries nothing the backend can file — it is
    // the residue of an added-then-abandoned row, not an omission to report.
    const filled = (rows ?? [])
      .map(toInput)
      .filter((track) => track.artist_name.length > 0);
    onSave(filled);
  };

  if (isLoading) {
    return (
      <Stack spacing={1} alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size="sm" />
        <Typography level="body-sm">Checking Discogs for a tracklist…</Typography>
      </Stack>
    );
  }

  if (isError && rows === null) {
    return (
      <Stack spacing={1.5}>
        <Sheet variant="soft" color="warning" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
          <Typography level="body-sm">
            {`"${albumTitle}" was saved, but the Discogs tracklist couldn't be fetched. This isn't the same as Discogs having no match — retrying may still import the tracks.`}
          </Typography>
        </Sheet>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="plain" onClick={onSkip}>
            Skip for now
          </Button>
          <Button variant="outlined" onClick={startManualEntry}>
            Enter tracks manually
          </Button>
          <Button onClick={() => refetch()}>Try again</Button>
        </Stack>
      </Stack>
    );
  }

  const importedCount = suggestions?.tracks.length ?? 0;
  const matchedUpstream = suggestions?.discogs_release_id != null && importedCount > 0;

  return (
    <Stack spacing={1.5}>
      <Typography level="body-sm">
        {matchedUpstream
          ? `Imported ${importedCount} ${importedCount === 1 ? "track" : "tracks"} from Discogs for "${albumTitle}". Confirm or correct the per-track artists before saving.`
          : `No Discogs tracklist matched "${albumTitle}". Add the per-track artists by hand, or skip and file the release without them.`}
      </Typography>

      <Stack spacing={1}>
        {(rows ?? []).map((row, index) => (
          <Stack key={row.key} direction="row" spacing={0.5} alignItems="center">
            <Input
              value={row.track_position}
              disabled={isSaving}
              placeholder="A1"
              aria-label={`Position for track ${index + 1}`}
              onChange={(e) => updateRow(row.key, { track_position: e.target.value })}
              sx={{ width: 72 }}
            />
            <Input
              value={row.artist_name}
              disabled={isSaving}
              placeholder="Artist"
              aria-label={`Artist for track ${index + 1}`}
              onChange={(e) => updateRow(row.key, { artist_name: e.target.value })}
              sx={{ flex: 1 }}
            />
            <Input
              value={row.track_title}
              disabled={isSaving}
              placeholder="Track title"
              aria-label={`Title for track ${index + 1}`}
              onChange={(e) => updateRow(row.key, { track_title: e.target.value })}
              sx={{ flex: 1 }}
            />
            <IconButton
              variant="plain"
              color="neutral"
              disabled={isSaving}
              aria-label={`Remove track ${index + 1}`}
              onClick={() => removeRow(row.key)}
            >
              <Delete />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="plain"
          size="sm"
          startDecorator={<Add />}
          disabled={isSaving}
          onClick={addRow}
        >
          Add track
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="plain" disabled={isSaving} onClick={onSkip}>
            Skip for now
          </Button>
          <Button loading={isSaving} onClick={handleSave}>
            Save Tracks
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
