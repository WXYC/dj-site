"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Option,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useGetFormatsQuery,
  useGetGenresQuery,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import {
  AlbumEntry,
  ArtistInGenreOption,
  UpdateAlbumRequestBody,
} from "@/lib/features/catalog/types";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";

interface AlbumEditFormProps {
  album: AlbumEntry;
}

type SavedFields = {
  title: string;
  label: string;
  genreId: number | undefined;
  formatId: number | undefined;
  artistId: number | undefined;
  alternateArtistName: string;
  discQuantity: number | undefined;
};

function snapshotFromAlbum(album: AlbumEntry): SavedFields {
  return {
    title: album.title,
    label: album.label ?? "",
    genreId: album.genre_id,
    formatId: album.format_id,
    artistId: album.artist_id ?? album.artist.id,
    alternateArtistName: album.alternate_artist ?? "",
    discQuantity: album.disc_quantity,
  };
}

/**
 * MD+ general catalog edit form: batches title/label/genre/format/artist-link/
 * alternate-artist-name/disc-quantity edits into one `PATCH /library/:id`
 * carrying only the changed fields. Mount with `key={album.id}` from the
 * caller, alongside `DiscogsUnavailableControl` — local state is seeded from
 * `album` on mount only, matching that control's pattern.
 *
 * One Save button rather than per-field auto-save: artist rows are
 * genre-scoped, so a genre change has to retract a stale `artist_id` in the
 * same request that carries the new `genre_id`. Across two independent
 * PATCHes there would be a window where the album is filed under an artist
 * that doesn't exist in its new genre, with the artist field still reading
 * the old (correct-looking) name. A single batched request makes that
 * invariant enforceable before anything goes out.
 */
function AlbumEditForm({ album }: AlbumEditFormProps) {
  return (
    <RequireMD>
      <AlbumEditFormFields album={album} />
    </RequireMD>
  );
}

function AlbumEditFormFields({ album }: AlbumEditFormProps) {
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();
  const { data: genres } = useGetGenresQuery();
  const { data: formats } = useGetFormatsQuery();

  const [saved, setSaved] = useState<SavedFields>(() => snapshotFromAlbum(album));

  const [title, setTitle] = useState(saved.title);
  const [label, setLabel] = useState(saved.label);
  const [genreId, setGenreId] = useState<number | undefined>(saved.genreId);
  const [formatId, setFormatId] = useState<number | undefined>(saved.formatId);
  const [artistName, setArtistName] = useState(album.artist.name);
  const [artistId, setArtistId] = useState<number | undefined>(saved.artistId);
  const [alternateArtistName, setAlternateArtistName] = useState(
    saved.alternateArtistName,
  );
  const [discQuantity, setDiscQuantity] = useState<number | undefined>(
    saved.discQuantity,
  );
  const [clearLabelId, setClearLabelId] = useState(false);

  // True once the current `artistId` has been confirmed via a fresh pick
  // (ArtistSearchTypeahead's `onSelect`) under the genre presently held here.
  // The seeded id read from `album` starts unconfirmed: the typeahead's own
  // `onSelectionCleared` only retracts selections it reported through
  // `onSelect` (its docblock states this explicitly), so a genre change while
  // this stays false has to invalidate the seeded id here instead — the
  // typeahead never confirmed it and so never retracts it.
  const artistConfirmedForGenre = useRef(false);

  const handleGenreChange = (nextGenreId: number | undefined) => {
    setGenreId(nextGenreId);
    if (
      !artistConfirmedForGenre.current &&
      nextGenreId !== undefined &&
      nextGenreId !== saved.genreId
    ) {
      setArtistId(undefined);
    }
  };

  const handleArtistSelect = (artist: ArtistInGenreOption) => {
    artistConfirmedForGenre.current = true;
    setArtistId(artist.id);
  };

  const handleArtistSelectionCleared = () => {
    artistConfirmedForGenre.current = false;
    setArtistId(undefined);
  };

  const handleArtistCreateNew = () => {
    toast.info(
      "Creating a new artist isn't supported from this form yet — use the artist-add flow first, then search for it here.",
    );
  };

  const trimmedTitle = title.trim();
  const trimmedLabel = label.trim();
  const trimmedAlternateArtistName = alternateArtistName.trim();

  const changes: UpdateAlbumRequestBody = {};
  if (trimmedTitle !== saved.title) changes.album_title = trimmedTitle;
  if (trimmedLabel !== saved.label) changes.label = trimmedLabel;
  if (genreId !== undefined && genreId !== saved.genreId) changes.genre_id = genreId;
  if (formatId !== undefined && formatId !== saved.formatId)
    changes.format_id = formatId;
  if (artistId !== undefined && artistId !== saved.artistId)
    changes.artist_id = artistId;
  if (trimmedAlternateArtistName !== saved.alternateArtistName) {
    changes.alternate_artist_name =
      trimmedAlternateArtistName.length > 0 ? trimmedAlternateArtistName : null;
  }
  if (discQuantity !== undefined && discQuantity !== saved.discQuantity) {
    changes.disc_quantity = discQuantity;
  }
  if (clearLabelId) changes.label_id = null;

  const hasChanges = Object.keys(changes).length > 0;
  // An album always needs a definite artist link, so Save must stay blocked
  // while it's unresolved — whether that's from a genre change invalidating
  // the seeded id or from editing the artist text away from a confirmed pick.
  const artistLinkMissing = artistId === undefined;
  const canSave = hasChanges && !artistLinkMissing && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      const updated = await updateAlbum({ albumId: album.id, body: changes }).unwrap();
      const nextSaved = snapshotFromAlbum(updated);
      setSaved(nextSaved);
      setTitle(nextSaved.title);
      setLabel(nextSaved.label);
      setGenreId(nextSaved.genreId);
      setFormatId(nextSaved.formatId);
      setArtistName(updated.artist.name);
      setArtistId(nextSaved.artistId);
      artistConfirmedForGenre.current = false;
      setAlternateArtistName(nextSaved.alternateArtistName);
      setDiscQuantity(nextSaved.discQuantity);
      setClearLabelId(false);
      toast.success("Album updated");
    } catch {
      toast.error("Failed to update album");
    }
  };

  return (
    <Stack spacing={1.5}>
      <FormControl>
        <FormLabel>Title</FormLabel>
        <Input size="sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Label</FormLabel>
        <Input size="sm" value={label} onChange={(e) => setLabel(e.target.value)} />
      </FormControl>

      <FormControl>
        <FormLabel>Genre</FormLabel>
        <Select
          size="sm"
          aria-label="Genre"
          value={genreId ?? null}
          onChange={(_, value) => handleGenreChange(value ?? undefined)}
        >
          {(genres ?? []).map((genre) => (
            <Option key={genre.id} value={genre.id}>
              {genre.genre_name}
            </Option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Format</FormLabel>
        <Select
          size="sm"
          aria-label="Format"
          value={formatId ?? null}
          onChange={(_, value) => setFormatId(value ?? undefined)}
        >
          {(formats ?? []).map((format) => (
            <Option key={format.id} value={format.id}>
              {format.format_name}
            </Option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Artist</FormLabel>
        <ArtistSearchTypeahead
          genreId={genreId ?? saved.genreId ?? 0}
          value={artistName}
          onChange={setArtistName}
          onSelect={handleArtistSelect}
          onCreateNew={handleArtistCreateNew}
          onSelectionCleared={handleArtistSelectionCleared}
        />
        {artistLinkMissing && (
          <FormHelperText>
            Search and select an artist to continue — the previous link no
            longer applies under this genre.
          </FormHelperText>
        )}
      </FormControl>

      <FormControl>
        <FormLabel>Alternate Artist Name</FormLabel>
        <Input
          size="sm"
          value={alternateArtistName}
          onChange={(e) => setAlternateArtistName(e.target.value)}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Disc Quantity</FormLabel>
        <Input
          size="sm"
          type="number"
          slotProps={{ input: { min: 1 } }}
          value={discQuantity ?? ""}
          onChange={(e) =>
            setDiscQuantity(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      </FormControl>

      <FormControl
        orientation="horizontal"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <FormLabel>Clear linked label record</FormLabel>
        <Switch
          checked={clearLabelId}
          onChange={(e) => setClearLabelId(e.target.checked)}
        />
      </FormControl>
      {clearLabelId && (
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          Unlinks the label record (label_id) without changing the Label text
          above.
        </Typography>
      )}

      <Divider />

      <FormControl>
        <FormLabel>Album Artist</FormLabel>
        <Input size="sm" value={album.album_artist ?? ""} disabled />
        <Typography level="body-xs" sx={{ mt: 0.5, color: "text.tertiary" }}>
          Set by tubafrenzy for compilations; editing it here isn&apos;t
          supported yet.
        </Typography>
      </FormControl>

      <Stack direction="row" justifyContent="flex-end">
        <Button size="sm" disabled={!canSave} loading={saving} onClick={handleSave}>
          Save
        </Button>
      </Stack>
    </Stack>
  );
}

export default AlbumEditForm;
