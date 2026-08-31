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

/**
 * Where the current rows came from, so the heading can't outlive what it
 * describes. The manual arm carries its reason because the three ways of
 * arriving there are not interchangeable: "Discogs had nothing", "Discogs had
 * only what is already filed", and "the librarian chose to type them" are
 * three different claims, and stating the first when either of the others is
 * true is the false negative this whole component is arranged to prevent.
 */
type Seed =
  | { kind: "discogs"; importedCount: number; alreadyFiledCount: number }
  | { kind: "manual"; reason: "no-match" | "all-filed" | "chosen" };

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
  /** Label for the affordance that leaves without saving. */
  skipLabel?: string;
  /**
   * Whether this release could already hold per-track credits.
   *
   * Defaults to `true`, the reading that is safe for any release the caller
   * did not itself just create: a caller that says nothing gets the
   * conservative behaviour, and the cheaper `false` has to be claimed out
   * loud. Passing `false` asserts that nothing has written credits for this
   * release — true only in the moments after an add, before any write has been
   * attempted — and buys one skipped request in exchange for that claim.
   */
  mayAlreadyHoldCredits?: boolean;
};

/**
 * Per-track artist capture for a Various-Artists release. Without it a
 * compilation is filed with tracks that are individually unfindable —
 * release-level search is the only thing that would ever match them.
 *
 * Two callers, and the difference between them is one prop. The add-release
 * panel shows it for a release created seconds earlier, where nothing can yet
 * be on file; the album detail panel shows it for a release of any age, where
 * anything may be. Both are wrapped whole by the MD authorization gate, which
 * — not this component — is what holds the suggestions read to the librarian
 * bar the backend enforces on it: that read triggers upstream Discogs work and
 * is deliberately not a catalog-read route.
 *
 * **It is a confirmation surface, not a data-entry one.** Nobody hand-types
 * per-track artists for a twenty-track compilation, so Discogs fills the form
 * on arrival and the librarian confirms or corrects it. Hand entry survives
 * only for the cases that earn it, and they are kept strictly apart — Discogs
 * answering with nothing, Discogs answering with only what is already filed,
 * and Discogs not answering at all. Rendering an outage as "no match" is what
 * costs a librarian a tracklist typed by hand for a release Discogs would have
 * supplied a minute later.
 *
 * The write behind `onSave` can only add credits, never amend or remove one,
 * so a credit that reaches storage is permanent as far as this panel is
 * concerned. Everything below follows from that:
 *
 * - Credits already on file are dropped from the seed rather than offered back
 *   as editable rows. Re-offering one invites a correction, and since
 *   `artist_name` is part of the server's uniqueness key, a corrected spelling
 *   is filed *beside* the original rather than replacing it.
 * - A credit that lands after the rows were seeded — the residue of a write
 *   that committed and then failed to deliver its response — is locked in
 *   place instead, since by then it is on screen and cannot be silently
 *   withdrawn.
 * - Saving is refused whenever the stored-credit read has not succeeded. If
 *   that read has not landed, the panel does not know what is out there and
 *   refuses to write rather than guessing — an unreadable backend is exactly
 *   the one whose earlier write is most likely to have half-succeeded.
 */
export default function VaTracklistStep({
  libraryId,
  albumTitle,
  onSave,
  onSkip,
  isSaving,
  skipLabel = "Skip for now",
  mayAlreadyHoldCredits = true,
}: VaTracklistStepProps) {
  const {
    data: suggestions,
    isFetching,
    isError,
    refetch,
  } = useGetCompilationTrackSuggestionsQuery({ libraryId });

  const {
    data: stored,
    isError: storedFailed,
    isFetching: storedFetching,
    refetch: refetchStored,
  } = useGetCompilationTracksQuery(
    { libraryId },
    { skip: !mayAlreadyHoldCredits },
  );

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

  // What the release holds, known only once the read has actually succeeded —
  // never inferred from an empty array, which is indistinguishable from "not
  // loaded yet" the moment this component mounts. A failed refetch leaves the
  // previous payload in `stored`; that payload predates the write that
  // prompted the refetch, so it does not count as knowing.
  const storedKnown = !!stored && !storedFailed && !storedFetching;

  if (suggestions && (!mayAlreadyHoldCredits || storedKnown) && seed === null) {
    const alreadyFiled = new Set((stored?.tracks ?? []).map(creditKey));
    const fresh = suggestions.tracks.filter(
      (track) => !alreadyFiled.has(creditKey(track)),
    );
    const alreadyFiledCount = suggestions.tracks.length - fresh.length;
    if (fresh.length > 0) {
      setSeed({ kind: "discogs", importedCount: fresh.length, alreadyFiledCount });
      setRows(fresh.map(rowFromSuggestion));
    } else {
      // Discogs having matched every track that is already filed is not Discogs
      // having no match, and the sleeve may still hold one it missed.
      setSeed({
        kind: "manual",
        reason: alreadyFiledCount > 0 ? "all-filed" : "no-match",
      });
      setRows([blankRow()]);
    }
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
    setSeed({ kind: "manual", reason: "chosen" });
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
  // `stored` is the only account of what the release holds. Until it arrives,
  // what a write would add to is unknown.
  const reconciled = !mayAlreadyHoldCredits || storedKnown;

  if (rows === null || seed === null) {
    // The stored read decides which suggestions are already filed, so its
    // failure blocks seeding for the same reason it blocks saving: offering a
    // credit that is already on file would file it twice.
    if (storedFailed && !storedFetching) {
      return (
        <Stack spacing={1.5}>
          <Sheet variant="soft" color="danger" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
            <Typography level="body-sm">
              {`Couldn't check which credits "${albumTitle}" already holds, so its tracklist can't be filled in yet — offering a credit that is already on file would file it twice.`}
            </Typography>
          </Sheet>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" onClick={onSkip}>
              {skipLabel}
            </Button>
            <Button onClick={() => refetchStored()}>Try again</Button>
          </Stack>
        </Stack>
      );
    }

    if (isError && !isFetching) {
      return (
        <Stack spacing={1.5}>
          <Sheet variant="soft" color="warning" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
            <Typography level="body-sm">
              {`The Discogs tracklist for "${albumTitle}" couldn't be fetched. This isn't the same as Discogs having no match — retrying may still import the tracks.`}
            </Typography>
          </Sheet>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" onClick={onSkip}>
              {skipLabel}
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
      ? seed.alreadyFiledCount > 0
        ? `Imported ${seed.importedCount} new ${seed.importedCount === 1 ? "track" : "tracks"} from Discogs for "${albumTitle}"; ${seed.alreadyFiledCount} ${seed.alreadyFiledCount === 1 ? "was" : "were"} already on file. Confirm or correct the per-track artists before saving.`
        : `Imported ${seed.importedCount} ${seed.importedCount === 1 ? "track" : "tracks"} from Discogs for "${albumTitle}". Confirm or correct the per-track artists before saving.`
      : seed.reason === "no-match"
        ? `No Discogs tracklist matched "${albumTitle}". Add the per-track artists by hand, or leave them for now.`
        : seed.reason === "all-filed"
          ? `Discogs matched "${albumTitle}", and every track it lists is already on file. Add anything it missed by hand.`
          : `Entering the per-track artists for "${albumTitle}" by hand.`;

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

      {/* Only the failure is announced. A read that is merely in flight —
          which is every read the write invalidates, successful ones included —
          leaves the Save button disabled and says nothing: a danger banner
          raised on the routine case would cry wolf over the one case that is
          actually dangerous. */}
      {storedFailed && !storedFetching && (
        <Sheet variant="soft" color="danger" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
          <Typography level="body-sm">
            Couldn&apos;t check which credits are already on file, so saving could file
            duplicates that can&apos;t be removed here.
          </Typography>
          <Button
            size="sm"
            variant="outlined"
            sx={{ mt: 1 }}
            onClick={() => refetchStored()}
          >
            Check again
          </Button>
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
            {skipLabel}
          </Button>
          {/* Disabled rather than silently closing on an empty list: a save that
              files nothing is indistinguishable from one that files twelve
              credits, and the leave-without-saving affordance is what means
              this. */}
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
