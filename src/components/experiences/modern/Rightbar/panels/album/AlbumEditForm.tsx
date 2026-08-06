"use client";

import { useState } from "react";
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
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import {
  useGetFormatsQuery,
  useGetGenresQuery,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import {
  ALBUM_TEXT_MAX_LENGTH,
  DISC_QUANTITY_MAX,
  DISC_QUANTITY_MIN,
} from "@/lib/features/catalog/constants";
import {
  AlbumEntry,
  ArtistInGenreOption,
  UpdateAlbumRequestBody,
} from "@/lib/features/catalog/types";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
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

/**
 * An artist id together with the genre it was resolved under. Artist rows are
 * genre-scoped, so an id alone cannot say whether it still describes the form:
 * the pair does, by comparison against the genre currently held.
 */
type ArtistLink = {
  id: number;
  genreId: number | undefined;
};

/**
 * Baseline values are trimmed, not stored verbatim. Rows predating the write
 * path's trimming can carry padding, and an untrimmed baseline compared against
 * a trimmed draft reads as a change nobody made — arming Save on open and
 * letting a trim-only PATCH advance the catalog's conditional-GET watermark and
 * re-fire metadata enrichment.
 */
function snapshotFromAlbum(album: AlbumEntry): SavedFields {
  return {
    title: album.title.trim(),
    label: (album.label ?? "").trim(),
    genreId: album.genre_id,
    formatId: album.format_id,
    artistId: album.artist_id ?? album.artist.id,
    alternateArtistName: (album.alternate_artist ?? "").trim(),
    discQuantity: album.disc_quantity,
  };
}

function artistLinkFrom(saved: SavedFields): ArtistLink | null {
  return saved.artistId === undefined
    ? null
    : { id: saved.artistId, genreId: saved.genreId };
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
  const [alternateArtistName, setAlternateArtistName] = useState(
    saved.alternateArtistName,
  );
  const [discQuantity, setDiscQuantity] = useState<number | undefined>(
    saved.discQuantity,
  );

  // The held link carries the genre it was resolved under so a genre change
  // invalidates it by comparison rather than by erasing it. Erasing is what
  // makes the round trip unrecoverable: an MD who changes the genre and changes
  // it back is left on an album whose every field reads its original value with
  // Save permanently blocked and nothing on screen explaining why. The link
  // seeded off the album starts here too — the typeahead's own
  // `onSelectionCleared` only retracts selections it reported through
  // `onSelect`, so it never speaks for a link this form read straight off the
  // album, and a genre change has to invalidate that one here instead.
  const [artistLink, setArtistLink] = useState<ArtistLink | null>(() =>
    artistLinkFrom(saved),
  );

  const handleArtistSelect = (artist: ArtistInGenreOption) => {
    setArtistLink({ id: artist.id, genreId });
  };

  // The typeahead retracts on two different events: the text was edited away
  // from the picked artist, or the genre moved off the one it was picked under.
  // Only the first invalidates the pair — a genre move leaves the text standing
  // deliberately, so the link is still true about the genre it names and the
  // comparison above is what should judge it. Telling them apart by whether
  // `genreId` has already moved past the link's is what lets a genre round trip
  // restore a picked link, exactly as it restores a seeded one; a same-genre
  // retraction still drops the link, because the text no longer names it.
  const handleArtistSelectionCleared = () => {
    setArtistLink((prev) => (prev !== null && prev.genreId !== genreId ? prev : null));
  };

  const handleArtistCreateNew = () => {
    toast.info(
      "Creating a new artist isn't supported from this form yet — use the artist-add flow first, then search for it here.",
    );
  };

  const trimmedTitle = title.trim();
  const trimmedLabel = label.trim();
  const trimmedAlternateArtistName = alternateArtistName.trim();

  // A link resolved under a different genre names no row under the current one.
  const artistLinkStaleForGenre =
    artistLink !== null && artistLink.genreId !== genreId;
  const artistId = artistLinkStaleForGenre ? undefined : artistLink?.id;

  // Backend-Service rejects an empty album_title outright (400), so an empty
  // draft must block Save rather than reach the request at all. The length caps
  // mirror the server's `varchar(128)` columns, which it rejects with a 400 of
  // its own.
  const titleInvalid = trimmedTitle.length === 0;
  const titleTooLong = trimmedTitle.length > ALBUM_TEXT_MAX_LENGTH;
  const labelTooLong = trimmedLabel.length > ALBUM_TEXT_MAX_LENGTH;
  const alternateArtistNameTooLong =
    trimmedAlternateArtistName.length > ALBUM_TEXT_MAX_LENGTH;
  // Blanking a previously-set disc_quantity has no way to reach the server
  // (the field isn't nullable in this contract) — blocking Save keeps the
  // draft from being silently discarded on the post-save reseed below.
  const discQuantityCleared =
    discQuantity === undefined && saved.discQuantity !== undefined;
  const discQuantityOutOfRange =
    discQuantity !== undefined &&
    (!Number.isInteger(discQuantity) ||
      discQuantity < DISC_QUANTITY_MIN ||
      discQuantity > DISC_QUANTITY_MAX);
  const discQuantityInvalid = discQuantityCleared || discQuantityOutOfRange;

  const changes: UpdateAlbumRequestBody = {};
  if (!titleInvalid && !titleTooLong && trimmedTitle !== saved.title)
    changes.album_title = trimmedTitle;
  // Backend-Service rejects an empty `label` string outright — clearing the
  // label is only reachable through `label_id: null`, which the server
  // treats as clearing both columns together. Sending `label` and
  // `label_id: null` in the same request is also rejected, so these two
  // branches must stay mutually exclusive.
  if (!labelTooLong && trimmedLabel !== saved.label) {
    if (trimmedLabel.length > 0) {
      changes.label = trimmedLabel;
    } else {
      changes.label_id = null;
    }
  }
  if (genreId !== undefined && genreId !== saved.genreId) changes.genre_id = genreId;
  if (formatId !== undefined && formatId !== saved.formatId)
    changes.format_id = formatId;
  if (artistId !== undefined && artistId !== saved.artistId)
    changes.artist_id = artistId;
  if (
    !alternateArtistNameTooLong &&
    trimmedAlternateArtistName !== saved.alternateArtistName
  ) {
    changes.alternate_artist_name =
      trimmedAlternateArtistName.length > 0 ? trimmedAlternateArtistName : null;
  }
  if (!discQuantityInvalid && discQuantity !== undefined && discQuantity !== saved.discQuantity) {
    changes.disc_quantity = discQuantity;
  }

  const hasChanges = Object.keys(changes).length > 0;
  // An album always needs a definite artist link, so Save must stay blocked
  // while it's unresolved — whether that's from a genre change invalidating
  // the seeded id or from editing the artist text away from a confirmed pick.
  const artistLinkMissing = artistId === undefined;
  const canSave =
    hasChanges &&
    !artistLinkMissing &&
    !titleInvalid &&
    !titleTooLong &&
    !labelTooLong &&
    !alternateArtistNameTooLong &&
    !discQuantityInvalid &&
    !saving;

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
      setArtistLink(artistLinkFrom(nextSaved));
      setAlternateArtistName(nextSaved.alternateArtistName);
      setDiscQuantity(nextSaved.discQuantity);
      toast.success("Album updated");
    } catch (err) {
      // The global rtkQueryErrorLogger middleware already toasts the server's
      // own message, and Backend-Service answers every rejection here with a
      // specific one ("Artist is not catalogued in the selected genre",
      // "format_id does not reference an existing format", …). A second
      // unconditional toast would bury it, so only speak for the one rejection
      // shape the middleware leaves silent.
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to update album");
      }
    }
  };

  return (
    <Stack spacing={1.5}>
      <Divider />
      <Typography level="title-sm">Edit Release</Typography>

      <FormControl error={titleInvalid || titleTooLong}>
        <FormLabel>Title</FormLabel>
        <Input
          size="sm"
          value={title}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
        />
        {titleInvalid && <FormHelperText>Title can&apos;t be empty.</FormHelperText>}
        {titleTooLong && (
          <FormHelperText>
            Title must be {ALBUM_TEXT_MAX_LENGTH} characters or fewer.
          </FormHelperText>
        )}
      </FormControl>

      <FormControl error={labelTooLong}>
        <FormLabel>Label</FormLabel>
        <Input
          size="sm"
          value={label}
          disabled={saving}
          onChange={(e) => setLabel(e.target.value)}
        />
        <FormHelperText>
          {labelTooLong
            ? `Label must be ${ALBUM_TEXT_MAX_LENGTH} characters or fewer.`
            : "Clearing this unlinks the label record too."}
        </FormHelperText>
      </FormControl>

      <FormControl>
        <FormLabel>Genre</FormLabel>
        <Select
          size="sm"
          aria-label="Genre"
          value={genreId ?? null}
          disabled={saving}
          onChange={(_, value) => setGenreId(value ?? undefined)}
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
          disabled={saving}
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
          disabled={saving}
        />
        {artistLinkMissing && (
          <FormHelperText>
            {artistLinkStaleForGenre
              ? "Search and select an artist to continue — the previous link no longer applies under this genre."
              : "Search and select an artist to continue."}
          </FormHelperText>
        )}
      </FormControl>

      <FormControl error={alternateArtistNameTooLong}>
        <FormLabel>Alternate Artist Name</FormLabel>
        <Input
          size="sm"
          value={alternateArtistName}
          disabled={saving}
          onChange={(e) => setAlternateArtistName(e.target.value)}
        />
        {alternateArtistNameTooLong && (
          <FormHelperText>
            Alternate artist name must be {ALBUM_TEXT_MAX_LENGTH} characters or
            fewer.
          </FormHelperText>
        )}
      </FormControl>

      <FormControl error={discQuantityInvalid}>
        <FormLabel>Disc Quantity</FormLabel>
        <Input
          size="sm"
          type="number"
          slotProps={{
            input: { min: DISC_QUANTITY_MIN, max: DISC_QUANTITY_MAX, step: 1 },
          }}
          value={discQuantity ?? ""}
          disabled={saving}
          onChange={(e) =>
            setDiscQuantity(e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
        {discQuantityCleared && (
          <FormHelperText>
            Disc quantity can&apos;t be cleared — restore a value to continue.
          </FormHelperText>
        )}
        {discQuantityOutOfRange && (
          <FormHelperText>
            Disc quantity must be a whole number between {DISC_QUANTITY_MIN} and{" "}
            {DISC_QUANTITY_MAX}.
          </FormHelperText>
        )}
      </FormControl>

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
          Save Release
        </Button>
      </Stack>
    </Stack>
  );
}

export default AlbumEditForm;
