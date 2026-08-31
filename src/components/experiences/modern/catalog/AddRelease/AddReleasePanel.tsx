"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@mui/icons-material";
import {
  Button,
  DialogTitle,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import { useAppDispatch } from "@/lib/hooks";
import {
  useAddAlbumMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useWriteCompilationTracksMutation,
} from "@/lib/features/catalog/api";
import { isCompilationReleaseArtistName } from "@/lib/features/catalog/is-compilation-artist";
import type {
  AddAlbumRequestBody,
  ArtistInGenreOption,
  CompilationTrackInput,
} from "@/lib/features/catalog/types";
import { labelsApi } from "@/lib/features/labels/api";
import type { Label } from "@/lib/features/labels/types";
import LabelSearchTypeahead from "./LabelSearchTypeahead";
import VaTracklistStep from "@/src/components/experiences/modern/catalog/VaTracklistStep";

/**
 * Exact 400 message `addAlbum` sends when an `artist_name` fails genre-scoped
 * resolution. Matched by value rather than by status code alone — a 400 can
 * also mean a blank album_title — so this form only offers the artist-add
 * route for the one failure that actually means "this artist isn't filed
 * here yet".
 */
const GENRE_SCOPED_ARTIST_MISS_MESSAGE =
  "Artist doesn't exist or hasn't released an album in this genre before. Add a new artist entry to the library";

function serverErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("data" in err)) return undefined;
  const { data } = err as { data?: unknown };
  if (!data || typeof data !== "object") return undefined;
  const { message } = data as { message?: unknown };
  return typeof message === "string" ? message : undefined;
}

function emptyForm() {
  return {
    albumTitle: "",
    genreId: null as number | null,
    formatId: null as number | null,
    artistName: "",
    artistId: null as number | null,
    labelName: "",
    labelId: null as number | null,
  };
}

function AddReleaseForm() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // Set on a genre-scoped artist miss (backend 400) or on the typeahead's own
  // "create new artist" pick — both mean the same thing: this exact text
  // names no artist filed under the chosen genre. The panel routes the MD
  // toward the (separate) artist-add form rather than dead-ending on a raw
  // error.
  const [artistNotFound, setArtistNotFound] = useState<
    { term: string; genreId: number } | null
  >(null);
  // Set only after a V/A release has actually been created, and carries the id
  // the server assigned it — the per-track write is addressed to that release,
  // so the step cannot exist before there is a release to address.
  // `attempted` latches on the first write attempt, successful or not. It is
  // what tells the step that the release can no longer be assumed empty: a
  // request that commits and then fails to deliver its response leaves rows
  // behind that only a read can discover.
  const [vaStep, setVaStep] = useState<
    { libraryId: number; albumTitle: string; attempted: boolean } | null
  >(null);
  // Bumped whenever the artist text or the genre changes — including the
  // reset a close (or a close-then-reopen) performs, since that also changes
  // both away from whatever a request in flight was submitted with. Compared
  // against a snapshot taken at submit time, this is what lets the async
  // continuation after an awaited request tell "nothing relevant has moved"
  // from "the panel now describes a different artist, genre, or release
  // entirely" — a plain field-vs-closure comparison of just the artist text
  // covers only one of those axes and misses the other.
  const formGenerationRef = useRef(0);
  const artistNameAtRenderRef = useRef(form.artistName);
  const genreIdAtRenderRef = useRef(form.genreId);
  if (
    artistNameAtRenderRef.current !== form.artistName ||
    genreIdAtRenderRef.current !== form.genreId
  ) {
    artistNameAtRenderRef.current = form.artistName;
    genreIdAtRenderRef.current = form.genreId;
    formGenerationRef.current += 1;
  }

  // Skipped until the dialog is open: these two lookups are static enough to
  // cache indefinitely, but every catalog page load by an MD would otherwise
  // fetch both on mount for a dialog usually never opened.
  const { data: genres } = useGetGenresQuery(undefined, { skip: !open });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !open });
  const [addAlbum, { isLoading }] = useAddAlbumMutation();
  // Held here rather than inside the tracklist step so that "a request this
  // panel started is still in flight" has one owner, which is what the
  // dismissal guard below reads.
  const [writeCompilationTracks, { isLoading: isSavingTracks }] =
    useWriteCompilationTracksMutation();

  const closePanel = () => {
    setOpen(false);
    setForm(emptyForm());
    setArtistNotFound(null);
    setVaStep(null);
  };

  const hasUnsavedInput = () =>
    form.albumTitle.trim() !== "" ||
    form.genreId !== null ||
    form.formatId !== null ||
    form.artistName.trim() !== "" ||
    form.labelName.trim() !== "";

  // Modal's onClose fires for a backdrop click, an Escape that reaches the
  // dialog, and the close button alike — all three would otherwise wipe a
  // part-filled form with no undo. A confirm only interrupts the two
  // accidental paths; the submit handler calls closePanel directly so a
  // completed save never asks the MD to confirm work they already finished.
  // Dismissal is refused outright while a save is in flight rather than
  // asking the confirm question at all: the request can still succeed a
  // moment later and create the row anyway, which would make "nothing has
  // been saved yet" false by the time the MD reads it.
  const handleDismiss = () => {
    if (isLoading || isSavingTracks) return;
    // Past the V/A step the release is already in the catalog, so "nothing has
    // been saved yet" would be false — and what dismissal costs is different in
    // kind: not the release, only its per-track credits, which nothing else in
    // the product can currently supply for an existing release.
    if (vaStep) {
      if (
        !confirm(
          `"${vaStep.albumTitle}" is already saved. Close without adding its per-track artists? They can't be added from here once this closes.`,
        )
      ) {
        return;
      }
      closePanel();
      return;
    }
    if (hasUnsavedInput() && !confirm("Discard this release? Nothing has been saved yet.")) {
      return;
    }
    closePanel();
  };

  const handleSaveTracks = async (tracks: CompilationTrackInput[]) => {
    if (!vaStep || tracks.length === 0) return;
    try {
      const { inserted, skipped } = await writeCompilationTracks({
        libraryId: vaStep.libraryId,
        tracks,
      }).unwrap();
      // `skipped` is reported rather than dropped: it is the only signal that a
      // credit the MD believed they were filing was already there, which after
      // a retry is the difference between "saved" and "saved nothing new".
      const skippedNote = skipped > 0 ? ` (${skipped} already filed)` : "";
      toast.success(
        `Added ${inserted} per-track ${inserted === 1 ? "artist" : "artists"} to "${vaStep.albumTitle}"${skippedNote}`,
      );
      closePanel();
    } catch {
      // Toasted by the global rtkQueryErrorLogger middleware. The panel stays
      // open on purpose: the rows are the only copy of work the MD may have
      // hand-entered, and closing would destroy them with no way to re-derive.
      //
      // Latched here rather than before the request: a rejection is the only
      // outcome that leaves the release in an unknown state, and `.unwrap()`
      // always settles, so this cannot be missed. Setting it up front would
      // instead fire the stored-credit read alongside every successful save,
      // whose result is discarded when the panel closes. The step gates the
      // next write on that read succeeding.
      setVaStep((current) => (current ? { ...current, attempted: true } : current));
    }
  };

  const handleGenreChange = (_: unknown, value: number | null) => {
    // Artist rows are genre-scoped (ArtistSearchTypeahead's own invariant),
    // so a resolved artist_id from the old genre names no row under the new
    // one; clearing it here keeps the typeahead's own retraction from being
    // the only thing standing between a genre swap and a misfiled release.
    setForm((f) => ({ ...f, genreId: value, artistId: null }));
    setArtistNotFound(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setArtistNotFound(null);

    const albumTitle = form.albumTitle.trim();
    const artistName = form.artistName.trim();
    const labelName = form.labelName.trim();
    const hasArtist = form.artistId !== null || artistName.length > 0;

    if (
      !albumTitle ||
      form.genreId === null ||
      form.formatId === null ||
      !hasArtist ||
      !labelName
    ) {
      toast.error("Album title, genre, format, artist, and label are all required");
      return;
    }
    const genreId = form.genreId;

    const body: AddAlbumRequestBody = {
      album_title: albumTitle,
      label: labelName,
      genre_id: genreId,
      format_id: form.formatId,
    };
    // A resolved artist_id is sent wherever the MD picked an existing artist:
    // only the id skips the genre-scoped name resolution that can 400, and an
    // explicit id short-circuits that resolution entirely.
    if (form.artistId !== null) {
      body.artist_id = form.artistId;
    }
    // artist_name rides along even when the id resolves the artist, because
    // resolution is not its only job: the name is also the sole artist input to
    // the post-insert metadata enrichment the backend kicks off. Omitting it
    // there leaves that lookup with an empty artist, which loses the artwork
    // and makes the enrichment cache key collide across every release that
    // shares an album title.
    if (artistName) {
      body.artist_name = artistName;
    }
    if (form.labelId !== null) {
      body.label_id = form.labelId;
    }
    // album_artist is declared on the shared AddAlbumRequest type but the
    // backend silently drops it — never send it. code_number is assigned
    // server-side here — never send it either.

    // Every field is disabled for the duration of this request (see the
    // `disabled={isLoading}` props below), so in the ordinary case nothing
    // can change before it settles. This is still taken as a snapshot rather
    // than trusted implicitly: a dismiss-and-reopen or a genre/artist change
    // land here the moment any gap in that disabling is found or reopened,
    // rather than silently reintroducing the stale-guidance bug this exists
    // to close.
    const submitGeneration = formGenerationRef.current;

    try {
      const created = await addAlbum(body).unwrap();
      // A free-typed label with no resolved id means the backend just
      // upserted a new row from `body.label`. labelsApi's searchLabels only
      // reads, so nothing else invalidates its cache — without this, a
      // reopened picker searching this same name within the 60s cache
      // window still shows the stale empty (or prior) result and offers to
      // create the very near-duplicate this field exists to prevent. This
      // runs unconditionally: the label really was created regardless of
      // what the dialog is showing by the time the response lands.
      if (form.labelId === null) {
        dispatch(labelsApi.util.invalidateTags([{ type: "LabelSearch", id: "LIST" }]));
      }
      // Closing on success looks identical to an accidental dismissal
      // without this: both leave the MD looking at the catalog page with no
      // dialog open, which invites a duplicate re-add of the same release.
      toast.success(`Added "${albumTitle}" to the catalog`);
      // Guarded on the generation: without it, a request whose panel was
      // dismissed and reopened onto a new, still-unsaved release would close
      // that unrelated form the moment this one's response arrived, discarding
      // it exactly as if the MD had cancelled — which they did not. The V/A
      // hand-off is guarded by the same test and for the same reason: it would
      // otherwise replace that unrelated form with a tracklist step addressed
      // to a release the MD has stopped looking at.
      if (formGenerationRef.current === submitGeneration) {
        // Detection is by name because it is the only signal available here:
        // `album_artist`, the deterministic V/A marker, is dropped by the
        // backend on this route (see the body-construction note above), so it
        // cannot be sent and cannot come back. The strict whole-name predicate
        // is deliberate — the lenient substring one would pull single artists
        // whose names merely contain "various" or "soundtrack" into a per-track
        // capture step that makes no sense for them.
        if (isCompilationReleaseArtistName(artistName)) {
          if (typeof created?.id === "number") {
            setVaStep({ libraryId: created.id, albumTitle, attempted: false });
          } else {
            // The per-track write is addressed by release id, so without one
            // there is no step to offer. Said out loud rather than closing as
            // if nothing were owed: these credits have no other entry point,
            // and a silent close reads as "this compilation needed none".
            toast.error(
              `"${albumTitle}" was saved, but its per-track artists couldn't be requested. Add them from the release once it appears in the catalog.`,
            );
            closePanel();
          }
        } else {
          closePanel();
        }
      }
    } catch (err) {
      // Guarded the same way as the success path above, and for the same
      // reason: a rejection that arrives after the artist text or the genre
      // has moved on would otherwise relabel guidance onto a term or a genre
      // the form no longer shows.
      if (
        formGenerationRef.current === submitGeneration &&
        serverErrorMessage(err) === GENRE_SCOPED_ARTIST_MISS_MESSAGE
      ) {
        setArtistNotFound({ term: artistName, genreId });
      }
      // Every rejection, this one included, has already been toasted with the
      // server's message by the global rtkQueryErrorLogger middleware — it
      // fires on the rejected action itself and has no per-endpoint opt-out.
      // The guidance above therefore adds a route out of the miss; it does not
      // replace the toast.
    }
  };

  return (
    <>
      <Button startDecorator={<AddCircle />} onClick={() => setOpen(true)}>
        Add Release
      </Button>
      <Modal open={open} onClose={handleDismiss}>
        <ModalDialog sx={{ maxWidth: vaStep ? 720 : 480, width: "100%" }}>
          <ModalClose />
          <DialogTitle>{vaStep ? "Per-Track Artists" : "Add Release"}</DialogTitle>
          {vaStep ? (
            <VaTracklistStep
              libraryId={vaStep.libraryId}
              albumTitle={vaStep.albumTitle}
              onSave={handleSaveTracks}
              onSkip={handleDismiss}
              isSaving={isSavingTracks}
              // The release was created moments ago by this panel and nothing
              // else writes these credits, so until a write has been attempted
              // it provably holds none — the one place entitled to skip the
              // stored-credit read. An attempt forfeits that claim: a request
              // can commit and then fail to deliver its response.
              mayAlreadyHoldCredits={vaStep.attempted}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack spacing={1.5}>
                <FormControl required>
                  <FormLabel>Album title</FormLabel>
                  <Input
                    value={form.albumTitle}
                    disabled={isLoading}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, albumTitle: e.target.value }))
                    }
                  />
                </FormControl>

                <FormControl required>
                  <FormLabel>Genre</FormLabel>
                  <Select
                    aria-label="Genre"
                    value={form.genreId}
                    disabled={isLoading}
                    onChange={handleGenreChange}
                    placeholder="Choose a genre..."
                  >
                    {(genres ?? []).map((genre) => (
                      <Option key={genre.id} value={genre.id}>
                        {genre.genre_name}
                      </Option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl required>
                  <FormLabel>Format</FormLabel>
                  <Select
                    aria-label="Format"
                    value={form.formatId}
                    disabled={isLoading}
                    onChange={(_, value: number | null) =>
                      setForm((f) => ({ ...f, formatId: value }))
                    }
                    placeholder="Choose a format..."
                  >
                    {(formats ?? []).map((format) => (
                      <Option key={format.id} value={format.id}>
                        {format.format_name}
                      </Option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl required>
                  <FormLabel>Artist</FormLabel>
                  {form.genreId !== null ? (
                    <ArtistSearchTypeahead
                      genreId={form.genreId}
                      value={form.artistName}
                      disabled={isLoading}
                      onChange={(value) => {
                        setForm((f) => ({ ...f, artistName: value }));
                        // The guidance names the exact term that missed, so it
                        // stops describing the field the moment that term is
                        // edited.
                        setArtistNotFound(null);
                      }}
                      onSelect={(artist: ArtistInGenreOption) => {
                        setForm((f) => ({ ...f, artistId: artist.id }));
                        setArtistNotFound(null);
                      }}
                      onCreateNew={(term) => {
                        // Choosing to create says this text names no existing
                        // artist, which retires any id picked earlier under the
                        // same text — the typeahead only retracts on an edit, and
                        // there is none on this path. Left standing, the id would
                        // file the release against the very artist the panel is
                        // telling the MD does not exist yet.
                        setForm((f) => ({ ...f, artistId: null }));
                        setArtistNotFound({ term, genreId: form.genreId as number });
                      }}
                      onSelectionCleared={() =>
                        setForm((f) => ({ ...f, artistId: null }))
                      }
                    />
                  ) : (
                    <Input disabled placeholder="Choose a genre first" />
                  )}
                </FormControl>

                {artistNotFound && (
                  <Sheet
                    variant="soft"
                    color="warning"
                    role="status"
                    sx={{ p: 1, borderRadius: "sm" }}
                  >
                    <Typography level="body-sm">
                      {`"${artistNotFound.term}" isn't filed under ${
                        genres?.find((g) => g.id === artistNotFound.genreId)
                          ?.genre_name ?? "this genre"
                      } yet. Add it as a new artist, then come back and add this release.`}
                    </Typography>
                  </Sheet>
                )}

                <FormControl required>
                  <FormLabel>Label</FormLabel>
                  <LabelSearchTypeahead
                    value={form.labelName}
                    disabled={isLoading}
                    onChange={(value) =>
                      setForm((f) => ({ ...f, labelName: value }))
                    }
                    onSelect={(label: Label) =>
                      setForm((f) => ({ ...f, labelId: label.id }))
                    }
                    onSelectionCleared={() =>
                      setForm((f) => ({ ...f, labelId: null }))
                    }
                  />
                </FormControl>

                <Stack direction="row" justifyContent="flex-end">
                  <Button type="submit" loading={isLoading}>
                    Save Release
                  </Button>
                </Stack>
              </Stack>
            </form>
          )}
        </ModalDialog>
      </Modal>
    </>
  );
}

export default function AddReleasePanel() {
  return (
    <RequireMD>
      <AddReleaseForm />
    </RequireMD>
  );
}
