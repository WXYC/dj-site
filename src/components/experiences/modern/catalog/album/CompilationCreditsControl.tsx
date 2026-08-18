"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Divider,
  DialogTitle,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useGetCompilationTracksQuery,
  useWriteCompilationTracksMutation,
} from "@/lib/features/catalog/api";
import { isVariousArtists } from "@/lib/features/catalog/libraryCode";
import type { AlbumEntry, CompilationTrackInput } from "@/lib/features/catalog/types";
import VaTracklistStep from "@/src/components/experiences/modern/catalog/VaTracklistStep";

interface CompilationCreditsControlProps {
  album: AlbumEntry;
}

/**
 * Per-track artist credits for a compilation already in the catalog — the
 * route modern did not have. `VaTracklistStep` used to be reachable only from
 * inside the add-release modal, so a compilation filed before credits existed,
 * one whose Discogs match improved since, or one whose librarian skipped the
 * step could never receive them here. Classic gained that route first
 * (`/dashboard/library/release/[id]/tracklist`); this is its modern half.
 *
 * The gate is `isVariousArtists` on the shelf's `code_letters`, never
 * `album_artist`. That column is written by the nightly catalog import and by
 * nothing else — no API path writes it, and on production it is empty for
 * every one of the ~6,300 releases on the compilation shelf — so gating a
 * *write* affordance on it would hide this control from exactly the releases
 * that need it. The structural rule also covers `Soundtracks - <letter>`,
 * which carries no "various" keyword anywhere in its name.
 *
 * `RequireMD` is the gate because the modern catalog page has no server-side
 * one; Backend independently requires `catalog: ['write']` for the POST, so
 * this hides an affordance rather than being the authority. It wraps the whole
 * control so the reads below never run for a viewer who could not act on them.
 */
export default function CompilationCreditsControl({
  album,
}: CompilationCreditsControlProps) {
  // `synthesizeAlbumId` hands out negative ids to rows the library never
  // linked, and an LML-sourced row carries a legacy id in this field. Neither
  // addresses a `library.id`, and every compilation-track endpoint resolves its
  // path param against one — so a request built from either would silently
  // read or write some other, real release's rows.
  const libraryId = album.id;

  if (libraryId === null || libraryId <= 0 || !isVariousArtists(album.artist.lettercode)) {
    return null;
  }

  return (
    <RequireMD>
      <CompilationCreditsFields libraryId={libraryId} albumTitle={album.title} />
    </RequireMD>
  );
}

/**
 * Mount with `key={album.id}` from the caller so a half-entered tracklist
 * doesn't leak into the next album.
 */
function CompilationCreditsFields({
  libraryId,
  albumTitle,
}: {
  libraryId: number;
  albumTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [writeCompilationTracks, { isLoading: isSaving }] =
    useWriteCompilationTracksMutation();

  // Never skipped: this release exists and may hold anything. The same query
  // backs the editor's own reconciliation — RTK Query serves both subscribers
  // from one cache entry, so listing the credits here costs no extra request.
  const {
    data: stored,
    isError: storedFailed,
    isFetching: storedFetching,
    refetch: refetchStored,
  } = useGetCompilationTracksQuery({ libraryId });

  const tracks = stored?.tracks ?? [];
  // Distinguished from "none on file": an unreadable backend must not be
  // reported as an empty tracklist, which is what would send a librarian to
  // re-file credits that are already there.
  const countKnown = !!stored && !storedFailed;

  const handleSave = async (drafted: CompilationTrackInput[]) => {
    if (drafted.length === 0) return;
    try {
      const { inserted, skipped } = await writeCompilationTracks({
        libraryId,
        tracks: drafted,
      }).unwrap();
      // `skipped` is reported rather than dropped: it is the only signal that a
      // credit the MD believed they were filing was already there, which after
      // a retry is the difference between "saved" and "saved nothing new".
      const skippedNote = skipped > 0 ? ` (${skipped} already filed)` : "";
      toast.success(
        `Added ${inserted} per-track ${inserted === 1 ? "artist" : "artists"} to "${albumTitle}"${skippedNote}`,
      );
      setOpen(false);
    } catch {
      // Toasted by the global rtkQueryErrorLogger middleware. The editor stays
      // open on purpose: the rows are the only copy of work the MD may have
      // hand-entered, and closing would destroy them with no way to re-derive.
      // The write invalidates the stored-credit read whether it succeeded or
      // failed, so the editor re-reads and refuses to save again until it knows
      // what actually landed.
    }
  };

  return (
    <>
      <Divider sx={{ my: 1 }} />
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography level="title-sm">Per-track credits</Typography>
        <Button
          size="sm"
          variant="outlined"
          onClick={() => setOpen(true)}
          // Opening fires the Discogs suggestions read, which is upstream work
          // rather than a cache hit — so it is deliberately behind this click
          // rather than fired for every compilation an MD happens to look at.
        >
          {countKnown && tracks.length > 0 ? "Add more credits" : "Import from Discogs"}
        </Button>
      </Stack>

      {storedFailed ? (
        <Sheet variant="soft" color="warning" role="alert" sx={{ p: 1, borderRadius: "sm" }}>
          <Typography level="body-sm">
            Couldn&apos;t load the credits already on file for this release.
          </Typography>
          <Button
            size="sm"
            variant="outlined"
            disabled={storedFetching}
            sx={{ mt: 1 }}
            onClick={() => refetchStored()}
          >
            Try again
          </Button>
        </Sheet>
      ) : !countKnown ? (
        <Typography level="body-sm" sx={{ color: "text.tertiary", fontStyle: "italic" }}>
          Checking which credits are on file…
        </Typography>
      ) : tracks.length === 0 ? (
        <Typography level="body-sm" sx={{ color: "text.tertiary", fontStyle: "italic" }}>
          No per-track credits on file yet.
        </Typography>
      ) : (
        <Table size="sm" stripe="odd" aria-label="Per-track credits on file">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Artist</th>
              <th>Track</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => (
              <tr key={track.id}>
                <td>{track.track_position ?? String(index + 1)}</td>
                <td>{track.artist_name}</td>
                <td>{track.track_title ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog sx={{ maxWidth: 720, width: "100%" }}>
          <ModalClose />
          <DialogTitle>Per-Track Artists</DialogTitle>
          {/* `mayAlreadyHoldCredits` is left at its default. This release is of
              unknown age and anything may be on file — the opposite of the
              claim the add-release panel is entitled to make about a release it
              created seconds ago. The modal unmounts its children on close, so
              a dismissed draft does not come back on the next opening. */}
          <VaTracklistStep
            libraryId={libraryId}
            albumTitle={albumTitle}
            onSave={handleSave}
            onSkip={() => setOpen(false)}
            isSaving={isSaving}
            skipLabel="Close"
          />
        </ModalDialog>
      </Modal>
    </>
  );
}
