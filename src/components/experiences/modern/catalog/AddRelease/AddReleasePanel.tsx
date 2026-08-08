"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@mui/icons-material";
import {
  Button,
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
} from "@/lib/features/catalog/api";
import type { AddAlbumRequestBody, ArtistInGenreOption } from "@/lib/features/catalog/types";
import { labelsApi } from "@/lib/features/labels/api";
import type { LabelRow } from "@/lib/features/labels/types";
import LabelSearchTypeahead from "./LabelSearchTypeahead";

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
  // Live mirror of the artist field: the submit handler's catch runs after an
  // awaited rejection, by which point a still-mounted panel may have moved on
  // to a different typed term. Reading this instead of the term captured at
  // submit time is what lets the catch refuse to relabel guidance onto text
  // the MD has since edited away from.
  const artistNameRef = useRef(form.artistName);
  artistNameRef.current = form.artistName;

  // Skipped until the dialog is open: these two lookups are static enough to
  // cache indefinitely, but every catalog page load by an MD would otherwise
  // fetch both on mount for a dialog usually never opened.
  const { data: genres } = useGetGenresQuery(undefined, { skip: !open });
  const { data: formats } = useGetFormatsQuery(undefined, { skip: !open });
  const [addAlbum, { isLoading }] = useAddAlbumMutation();

  const closePanel = () => {
    setOpen(false);
    setForm(emptyForm());
    setArtistNotFound(null);
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
  const handleDismiss = () => {
    if (hasUnsavedInput() && !confirm("Discard this release? Nothing has been saved yet.")) {
      return;
    }
    closePanel();
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

    if (!albumTitle || !form.genreId || !form.formatId || !hasArtist || !labelName) {
      toast.error("Album title, genre, format, artist, and label are all required");
      return;
    }

    const body: AddAlbumRequestBody = {
      album_title: albumTitle,
      label: labelName,
      genre_id: form.genreId,
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

    try {
      await addAlbum(body).unwrap();
      // A free-typed label with no resolved id means the backend just
      // upserted a new row from `body.label`. labelsApi's searchLabels only
      // reads, so nothing else invalidates its cache — without this, a
      // reopened picker searching this same name within the 60s cache
      // window still shows the stale empty (or prior) result and offers to
      // create the very near-duplicate this field exists to prevent.
      if (form.labelId === null) {
        dispatch(labelsApi.util.invalidateTags([{ type: "LabelSearch", id: "LIST" }]));
      }
      // Closing on success looks identical to an accidental dismissal
      // without this: both leave the MD looking at the catalog page with no
      // dialog open, which invites a duplicate re-add of the same release.
      toast.success(`Added "${albumTitle}" to the catalog`);
      closePanel();
    } catch (err) {
      // The field's own onChange already cleared any guidance the moment the
      // MD edited it; re-checking here guards the other direction, where the
      // edit happens first and this stale rejection arrives after.
      if (
        serverErrorMessage(err) === GENRE_SCOPED_ARTIST_MISS_MESSAGE &&
        form.genreId &&
        artistNameRef.current === artistName
      ) {
        setArtistNotFound({ term: artistName, genreId: form.genreId });
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
        <ModalDialog sx={{ maxWidth: 480, width: "100%" }}>
          <ModalClose />
          <Typography level="title-lg">Add Release</Typography>
          <form onSubmit={handleSubmit}>
            <Stack spacing={1.5}>
              <FormControl required>
                <FormLabel>Album title</FormLabel>
                <Input
                  value={form.albumTitle}
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
                  onChange={(value) =>
                    setForm((f) => ({ ...f, labelName: value }))
                  }
                  onSelect={(label: LabelRow) =>
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
