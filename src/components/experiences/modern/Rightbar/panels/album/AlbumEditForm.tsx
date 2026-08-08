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
 * An artist id together with the genre it was resolved under and the name it
 * was resolved for. An id alone cannot say whether it still describes the form:
 * artist rows are genre-scoped, and an id is only good for the text that
 * produced it. Carrying all three lets this form judge the link against what is
 * on screen at any moment, rather than depending on the typeahead to announce
 * every way it can go stale — its announcements cover only the selections it
 * made itself, and a link read straight off the album is never one of them.
 */
type ArtistLink = {
  id: number;
  genreId: number | undefined;
  name: string;
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

function artistLinkFrom(saved: SavedFields, name: string): ArtistLink | null {
  return saved.artistId === undefined
    ? null
    : { id: saved.artistId, genreId: saved.genreId, name };
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

  // The link is kept whole and judged by comparison rather than erased on the
  // first sign of trouble. Erasing is what makes a genre round trip
  // unrecoverable: an MD who changes the genre and changes it back would be
  // left on an album whose every field reads its original value with Save
  // permanently blocked and nothing on screen explaining why. The link seeded
  // off the album starts here too — the typeahead's `onSelectionCleared` only
  // retracts selections it reported through `onSelect`, so it never speaks for
  // a link this form read straight off the album.
  const [artistLink, setArtistLink] = useState<ArtistLink | null>(() =>
    artistLinkFrom(saved, album.artist.name),
  );

  // The genre the typeahead actually searches under: the Select has no "no
  // genre" option, so `genreId` only reads undefined before the MD has ever
  // touched it, and until then the search — and anything resolved from it —
  // has to fall back to the album's saved genre instead of going out scoped
  // to nothing. Every comparison against "the genre currently in effect" below
  // reads this, not the raw `genreId` state, so a pick resolved through the
  // fallback is never judged against a value it was never searched under.
  const resolvedGenreId = genreId ?? saved.genreId;

  const handleArtistSelect = (artist: ArtistInGenreOption) => {
    setArtistLink({ id: artist.id, genreId: resolvedGenreId, name: artist.artist_name });
  };

  // The typeahead retracts on two different events: the text was edited away
  // from the picked artist, or the genre moved off the one it was picked under.
  // A genre move leaves the text standing deliberately, so the link is still
  // true about what it names and the derivation below is what should weigh it;
  // dropping it here would defeat the round trip. Any other retraction is
  // acted on immediately. Either way the derivation below is the standing
  // authority — it re-checks both the genre and the name on every render.
  // It has to, because the two retractions differ in what follows them: a
  // text edit that lands back on the exact picked name re-announces that
  // artist through `onSelect`, restoring the link with no new pick, while a
  // genre move discards the selection for good.
  const handleArtistSelectionCleared = () => {
    setArtistLink((prev) => (prev !== null && prev.genreId !== resolvedGenreId ? prev : null));
  };

  // The typeahead always offers a create-new affordance; this form has no way
  // to honour it, and there is no artist-add surface anywhere to send the MD
  // to yet. The message must therefore say what is possible here rather than
  // name a detour that doesn't exist.
  const handleArtistCreateNew = (searchTerm: string) => {
    toast.info(
      `Adding a new artist isn't supported from this form — "${searchTerm}" must already be catalogued under the selected genre to be picked here.`,
    );
  };

  const trimmedTitle = title.trim();
  const trimmedLabel = label.trim();
  const trimmedAlternateArtistName = alternateArtistName.trim();

  // A link resolved under a different genre names no row under the current one,
  // and a link whose name no longer matches the field names an artist the MD is
  // no longer looking at. Either way the id must not reach the request: a
  // re-attribution the field contradicts is silent on screen and permanent on
  // the shelf, since the server can burn a fresh call number for it.
  const artistLinkStaleForGenre =
    artistLink !== null && artistLink.genreId !== resolvedGenreId;
  const artistLinkStaleForName =
    artistLink !== null && artistLink.name.trim() !== artistName.trim();
  const artistId =
    artistLink === null || artistLinkStaleForGenre || artistLinkStaleForName
      ? undefined
      : artistLink.id;

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
  // The 1-99 range is a PATCH-time rule, not a storage constraint:
  // `disc_quantity` is a plain smallint with no CHECK behind it, so rows
  // written by other paths already sit outside it. Only a value this draft
  // moved is held to the rule. Judging the stored value instead would strand
  // every such album — no unrelated field could be edited, and the range
  // message would sit under a field the MD never touched, until someone
  // invented a disc count for it.
  const discQuantityOutOfRange =
    discQuantity !== undefined &&
    discQuantity !== saved.discQuantity &&
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
    let updated: AlbumEntry;
    try {
      updated = await updateAlbum({ albumId: album.id, body: changes }).unwrap();
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to update album");
      }
      return;
    }

    // Deliberately outside the try: the write has already landed by this
    // point, so a throw here (a reseed bug, a toast call failing) must not be
    // reported as a failed save.
    const nextSaved = snapshotFromAlbum(updated);
    setSaved(nextSaved);
    setTitle(nextSaved.title);
    setLabel(nextSaved.label);
    setGenreId(nextSaved.genreId);
    setFormatId(nextSaved.formatId);
    setArtistName(updated.artist.name);
    setArtistLink(artistLinkFrom(nextSaved, updated.artist.name));
    setAlternateArtistName(nextSaved.alternateArtistName);
    setDiscQuantity(nextSaved.discQuantity);
    toast.success("Album updated");
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

      <FormControl error={artistLinkMissing}>
        <FormLabel>Artist</FormLabel>
        <ArtistSearchTypeahead
          // `resolvedGenreId` is only undefined for a legacy row with no genre
          // at all — there is no artist-in-genre search to run yet, and
          // `genre_id: 0` is not a real fallback: Backend-Service rejects it
          // outright, which would toast that rejection on every debounce tick
          // while the MD types. `disabled` below keeps the field inert (and
          // this prop unused) until a real genre resolves.
          genreId={resolvedGenreId ?? 0}
          value={artistName}
          onChange={setArtistName}
          onSelect={handleArtistSelect}
          onCreateNew={handleArtistCreateNew}
          onSelectionCleared={handleArtistSelectionCleared}
          disabled={saving || resolvedGenreId === undefined}
        />
        {artistLinkMissing && (
          <FormHelperText>
            {resolvedGenreId === undefined
              ? "Choose a genre before searching for an artist."
              : artistLinkStaleForGenre
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
