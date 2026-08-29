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
import {
  useGetCompilationTrackSuggestionsQuery,
  useGetCompilationTracksQuery,
} from "@/lib/features/catalog/api";
import { compilationTrackCreditKey } from "@/lib/features/catalog/compilationTrackCredits";
import type {
  CompilationTrack,
  CompilationTrackInput,
} from "@/lib/features/catalog/types";

type DraftRow = {
  /** Stable across edits and removals, so React never reuses one row's DOM for another. */
  key: number;
  artist_name: string;
  track_title: string;
  track_position: string;
};

/** Where the current rows came from, so the heading can't outlive what it describes. */
type Seed =
  | { kind: "discogs"; importedCount: number }
  | { kind: "manual" };

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

// See `compilationTrackCreditKey`: this and classic's release tracklist
// editor write against the same additive-only endpoint and must agree with
// its dedupe rule.
const creditKey = compilationTrackCreditKey;

export type VaTracklistStepProps = {
  libraryId: number;
  albumTitle: string;
  onSave: (tracks: CompilationTrackInput[]) => void;
  onSkip: () => void;
  isSaving: boolean;
  /**
   * Set once a write has been attempted against this release. Until then the
   * release is known-empty and the stored-credit read would be a wasted request.
   */
  hasAttemptedWrite: boolean;
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
 * a credit that reaches storage is permanent as far as this panel is concerned.
 * That is safe on the first write, into a release created moments earlier. It
 * stops being safe the instant a write has been *attempted*: a request that
 * commits and then fails to deliver its response leaves rows behind, and since
 * `artist_name` is part of the server's uniqueness key, re-submitting a
 * corrected spelling files it alongside the original rather than replacing it.
 *
 * So after any attempt, saving again is gated on a successful read of what
 * actually landed. If that read has not succeeded, the panel does not know what
 * is out there and refuses to write rather than guessing — an unreadable
 * backend is exactly the one whose earlier write is most likely to have
 * half-succeeded.
 */
export default function VaTracklistStep({
  libraryId,
  albumTitle,
  onSave,
  onSkip,
  isSaving,
  hasAttemptedWrite,
}: VaTracklistStepProps) {
  const {
    data: suggestions,
    isFetching,
    isError,
    refetch,
  } = useGetCompilationTrackSuggestionsQuery({ libraryId });

  // Skipped until a write has been attempted: before that the release was just
  // created and provably holds nothing.
  const {
    data: stored,
    isError: storedFailed,
    isFetching: storedFetching,
    refetch: refetchStored,
  } = useGetCompilationTracksQuery({ libraryId }, { skip: !hasAttemptedWrite });

  const [rows, setRows] = useState<DraftRow[] | null>(null);
  // What the current rows are, and what they were seeded from. Set together and
  // during render rather than in an effect: both are derived from the
  // suggestions response, not synchronized with anything outside React. Holding
  // the seed here rather than reading `suggestions` live at render time is what
  // stops a response that arrives after the rows were already seeded from
  // describing rows it did not produce.
  const [seed, setSeed] = useState<Seed | null>(null);
  // Row keys, not credit keys. A credit key recomputed from live input would
  // freeze a row the moment its half-typed contents happened to match a stored
  // credit — reachable by ordinary typing when the stored credit has no title —
  // and a frozen row cannot be finished. Identity is captured once, against the
  // rows that existed when the read landed.
  const [lockedRowKeys, setLockedRowKeys] = useState<number[]>([]);
  const [reconciledAgainst, setReconciledAgainst] = useState<
    CompilationTrack[] | null
  >(null);

  if (suggestions && seed === null) {
    const imported = suggestions.tracks;
    setSeed(
      imported.length > 0
        ? { kind: "discogs", importedCount: imported.length }
        : { kind: "manual" },
    );
    setRows(imported.length > 0 ? imported.map(rowFromSuggestion) : [blankRow()]);
  }

  // RTK Query hands back a stable reference while the payload is unchanged, so
  // this runs once per genuine change rather than on every render.
  if (stored && stored.tracks !== reconciledAgainst) {
    setReconciledAgainst(stored.tracks);
    const landed = new Set(stored.tracks.map(creditKey));
    const nowLocked = (rows ?? [])
      .filter((row) => landed.has(creditKey(toInput(row))))
      .map((row) => row.key);
    setLockedRowKeys((current) => [...new Set([...current, ...nowLocked])]);
  }

  // Entering manual entry from the error state is an explicit choice, not a
  // consequence of the read failing: an unreachable backend must never be able
  // to pass itself off as "Discogs matched nothing", which is the one reading
  // that costs the librarian a hand-typed tracklist.
  const startManualEntry = () => {
    setSeed({ kind: "manual" });
    setRows([blankRow()]);
  };

  const isLocked = (row: DraftRow) => lockedRowKeys.includes(row.key);

  const updateRow = (key: number, patch: Partial<DraftRow>) =>
    setRows((current) =>
      (current ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  const removeRow = (key: number) =>
    setRows((current) => (current ?? []).filter((row) => row.key !== key));

  const addRow = () => setRows((current) => [...(current ?? []), blankRow()]);

  // Rows the server already holds are excluded rather than resubmitted: an
  // unchanged one would be skipped anyway, and an edited one would be filed as
  // a second credit beside the row it was meant to correct.
  const submittable = (rows ?? [])
    .filter((row) => !isLocked(row))
    .map(toInput)
    .filter((track) => track.artist_name.length > 0);

  const lockedCount = (rows ?? []).filter(isLocked).length;
  // After an attempt, `stored` is the only account of what the release holds.
  // Until it arrives, what a second write would add is unknown.
  const reconciled = !hasAttemptedWrite || (!!stored && !storedFetching);

  if (rows === null || seed === null) {
    if (isError && !isFetching) {
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
    return (
      <Stack spacing={1} alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size="sm" />
        <Typography level="body-sm">Checking Discogs for a tracklist…</Typography>
      </Stack>
    );
  }

  const heading =
    seed.kind === "discogs"
      ? `Imported ${seed.importedCount} ${seed.importedCount === 1 ? "track" : "tracks"} from Discogs for "${albumTitle}". Confirm or correct the per-track artists before saving.`
      : `No Discogs tracklist matched "${albumTitle}". Add the per-track artists by hand, or skip and file the release without them.`;

  return (
    <Stack spacing={1.5}>
      <Typography level="body-sm">{heading}</Typography>

      {lockedCount > 0 && (
        <Sheet variant="soft" color="warning" role="status" sx={{ p: 1, borderRadius: "sm" }}>
          <Typography level="body-sm">
            {`${lockedCount} ${lockedCount === 1 ? "credit was" : "credits were"} already filed by an earlier attempt and can no longer be changed here. Saving again will file only the rest.`}
          </Typography>
        </Sheet>
      )}

      {hasAttemptedWrite && !reconciled && (
        <Sheet variant="soft" color="danger" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
          <Typography level="body-sm">
            {storedFailed
              ? "Couldn't check which credits the last attempt saved, so saving again could file duplicates that can't be removed here."
              : "Checking which credits the last attempt saved…"}
          </Typography>
          {storedFailed && (
            <Button
              size="sm"
              variant="outlined"
              sx={{ mt: 1 }}
              onClick={() => refetchStored()}
            >
              Check again
            </Button>
          )}
        </Sheet>
      )}

      <Stack direction="row" spacing={0.5} aria-hidden>
        <Typography level="body-xs" sx={{ width: 72 }}>
          Position
        </Typography>
        <Typography level="body-xs" sx={{ flex: 1 }}>
          Artist
        </Typography>
        <Typography level="body-xs" sx={{ flex: 1 }}>
          Track title
        </Typography>
        <Typography level="body-xs" sx={{ width: 40 }} />
      </Stack>

      <Stack spacing={1}>
        {(rows ?? []).map((row, index) => {
          const locked = isLocked(row);
          return (
            <Stack key={row.key} direction="row" spacing={0.5} alignItems="center">
              <Input
                value={row.track_position}
                disabled={isSaving || locked}
                placeholder="A1"
                aria-label={`Position for track ${index + 1}`}
                onChange={(e) => updateRow(row.key, { track_position: e.target.value })}
                sx={{ width: 72 }}
              />
              <Input
                value={row.artist_name}
                disabled={isSaving || locked}
                placeholder="Artist"
                aria-label={`Artist for track ${index + 1}${locked ? " (already filed)" : ""}`}
                onChange={(e) => updateRow(row.key, { artist_name: e.target.value })}
                sx={{ flex: 1 }}
              />
              <Input
                value={row.track_title}
                disabled={isSaving || locked}
                placeholder="Track title"
                aria-label={`Title for track ${index + 1}`}
                onChange={(e) => updateRow(row.key, { track_title: e.target.value })}
                sx={{ flex: 1 }}
              />
              {/* Removal stays available on a locked row. Locking withholds the
                  ability to file a competing correction, not the ability to
                  clear the row off the screen — a row that could neither be
                  edited nor removed would be a dead end with no exit but
                  discarding the whole tracklist. */}
              <IconButton
                variant="plain"
                color="neutral"
                disabled={isSaving}
                aria-label={`Remove track ${index + 1}`}
                onClick={() => removeRow(row.key)}
                sx={{ width: 40 }}
              >
                <Delete />
              </IconButton>
            </Stack>
          );
        })}
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
          {/* Disabled rather than silently closing on an empty list: a save that
              files nothing is indistinguishable from one that files twelve
              credits, and "Skip for now" is the affordance that means this. */}
          <Button
            loading={isSaving}
            disabled={submittable.length === 0 || !reconciled}
            onClick={() => onSave(submittable)}
          >
            Save Tracks
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
