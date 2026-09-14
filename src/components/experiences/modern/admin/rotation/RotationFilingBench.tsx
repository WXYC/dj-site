"use client";

import { useState, type JSX } from "react";
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import type { LibraryFilingConflictError, LibraryFilingResponse } from "@wxyc/shared";
import {
  useFileReleaseMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
} from "@/lib/features/catalog/api";
import { ARTIST_NAME_MAX_LENGTH } from "@/lib/features/catalog/adminCreateArtistValidation";
import { buildLibraryFilingRequest } from "@/lib/features/catalog/filingRequest";
import { isLibraryFilingConflict } from "@/lib/features/catalog/fileReleaseConflict";
import { isGenresUnavailable } from "@/lib/features/catalog/genreAvailability";
import type { ArtistInGenreOption } from "@/lib/features/catalog/types";
import { ROTATION_BIN_LABELS, type Rotation, RotationBin } from "@/lib/features/rotation/types";
import { useArtistDedupCheck } from "@/src/hooks/catalogHooks";
import ArtistSearchTypeahead from "@/src/components/shared/inputs/ArtistSearchTypeahead";
import CardPicker from "@/src/components/shared/inputs/CardPicker";
import UrlListInput from "@/src/components/shared/inputs/UrlListInput";
import CatalogRotationBinPicker from "@/src/components/experiences/modern/catalog/CatalogRotationBinPicker";
import FiledThisSession from "./FiledThisSession";

/**
 * A refused filing, snapshotted with the values the server actually rejected
 * so the message keeps naming them while the MD edits. Cleared per reason by
 * the one edit that could change the outcome: the artist reasons by their
 * fields' handlers, the card/bin mismatch by a bin or card change. While it
 * stands, the fields it names are exactly what was refused, so resubmitting
 * unchanged could only reach the same 409 — the submit gate blocks on it.
 */
type FilingConflict = {
  data: LibraryFilingConflictError;
};

/**
 * The Rotation Admin filing bench: one form, one submit — match-or-create the
 * artist, file the release, and (unless the bin is deselected) add the
 * rotation entry to a bin and card, all through the transactional
 * `POST /library/filings`.
 *
 * Compilations stay out deliberately: a Various Artists release keeps using
 * the existing album flows rather than being half-handled here, so the bench
 * says so instead of offering a V/A arm.
 */
export default function RotationFilingBench(): JSX.Element {
  const genresQuery = useGetGenresQuery();
  const formatsQuery = useGetFormatsQuery();
  const [fileRelease, { isLoading: isFiling }] = useFileReleaseMutation();

  const [genreId, setGenreId] = useState<number | null>(null);
  const [artistText, setArtistText] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistInGenreOption | null>(null);
  const [albumTitle, setAlbumTitle] = useState("");
  const [label, setLabel] = useState("");
  const [formatId, setFormatId] = useState<number | null>(null);
  const [bin, setBin] = useState<Rotation | null>(RotationBin.H);
  const [cardId, setCardId] = useState<number | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [conflict, setConflict] = useState<FilingConflict | null>(null);
  const [failed, setFailed] = useState(false);
  const [filings, setFilings] = useState<LibraryFilingResponse[]>([]);

  const trimmedArtist = artistText.trim();
  const artistTooLong = trimmedArtist.length > ARTIST_NAME_MAX_LENGTH;
  const dedup = useArtistDedupCheck(trimmedArtist);

  // See isGenresUnavailable for why this reads absence-of-list rather than
  // isError. The predicate is shape-generic despite its name, and the format
  // list fails the same way for the same reasons, so both gates share it.
  const genresUnavailable = isGenresUnavailable(genresQuery);
  const formatsUnavailable = isGenresUnavailable(formatsQuery);
  const listsUnavailable = genresUnavailable || formatsUnavailable;

  const cardConflict = conflict?.data.reason === "rotation_card_bin_mismatch";

  const canSubmit =
    !isFiling &&
    conflict === null &&
    genreId !== null &&
    formatId !== null &&
    !listsUnavailable &&
    albumTitle.trim().length > 0 &&
    !artistTooLong &&
    selectedArtist !== null;

  const handleArtistTextChange = (value: string) => {
    setArtistText(value);
    dedup.onNameChange(value);
  };

  const handleArtistSelected = (artist: ArtistInGenreOption) => {
    setSelectedArtist(artist);
    dedup.onArtistSelected(artist);
  };

  const handleSelectionCleared = () => {
    setSelectedArtist(null);
    dedup.onSelectionCleared();
  };

  const handleCreateNew = () => {
    setSelectedArtist(null);
    dedup.onCreateNewSelected();
  };

  const handleGenreChange = (value: number | null) => {
    setGenreId(value);
    // Every conflict reason that names an artist is genre-scoped, so a genre
    // change reopens the question whatever the reason was.
    setConflict(null);
    dedup.onGenreChange();
  };

  const clearCardConflict = () => {
    setConflict((current) =>
      current?.data.reason === "rotation_card_bin_mismatch" ? null : current,
    );
  };

  const handleBinChange = (nextBin: Rotation | null) => {
    setBin(nextBin);
    // A held card names a card in the previous bin; explicit null hands the
    // picker a cleared selection to re-default rather than a stale one.
    setCardId(null);
    clearCardConflict();
  };

  const handleCardChange = (nextCardId: number | null) => {
    setCardId(nextCardId);
    clearCardConflict();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || genreId === null || formatId === null || selectedArtist === null) {
      return;
    }

    const request = buildLibraryFilingRequest({
      artist: { mode: "existing", artistId: selectedArtist.id },
      genreId,
      formatId,
      albumTitle,
      label,
      rotationBin: bin,
      cardId,
      urls,
    });

    setFailed(false);
    try {
      const filed = await fileRelease(request).unwrap();
      setFilings((previous) => [...previous, filed]);
      // Ready for the next record of the batch: the artist and its release
      // clear; genre, label, format, bin and card persist, since an MD files
      // a stack of same-shaped records in one sitting.
      setArtistText("");
      setSelectedArtist(null);
      setAlbumTitle("");
      setUrls([]);
      dedup.reset();
    } catch (err) {
      // fileRelease nests its rejection under `fileReleaseError` to stay out
      // of the shared toast middleware; unwrap the nest before reading it.
      const wrapped =
        err && typeof err === "object" && "fileReleaseError" in err
          ? (err as { fileReleaseError: unknown }).fileReleaseError
          : err;
      if (isLibraryFilingConflict(wrapped)) {
        setConflict({ data: wrapped.data });
      } else {
        setFailed(true);
      }
    }
  };

  return (
    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="flex-start">
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md", flex: 1, maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5}>
            <FormControl error={listsUnavailable}>
              <FormLabel>Genre</FormLabel>
              <Select
                placeholder="Select genre..."
                value={genreId}
                disabled={isFiling || genresUnavailable}
                onChange={(_, value) => handleGenreChange(value)}
              >
                {(genresQuery.data ?? []).map((genre) => (
                  <Option key={genre.id} value={genre.id}>
                    {genre.genre_name}
                  </Option>
                ))}
              </Select>
              {listsUnavailable && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }} role="alert">
                  <Typography level="body-sm" color="danger">
                    {genresUnavailable ? "Genres" : "Formats"} are unavailable, so nothing
                    can be filed right now.
                  </Typography>
                  {/* An untyped button inside a form submits it. */}
                  <Button
                    type="button"
                    size="sm"
                    variant="plain"
                    loading={genresQuery.isFetching || formatsQuery.isFetching}
                    onClick={() => {
                      genresQuery.refetch();
                      formatsQuery.refetch();
                    }}
                    sx={{ px: 0 }}
                  >
                    Try again
                  </Button>
                </Stack>
              )}
            </FormControl>

            <FormControl error={artistTooLong}>
              <FormLabel>Artist</FormLabel>
              <ArtistSearchTypeahead
                genreId={genreId ?? -1}
                value={artistText}
                onChange={handleArtistTextChange}
                onSelect={handleArtistSelected}
                onCreateNew={handleCreateNew}
                onSelectionCleared={handleSelectionCleared}
                disabled={genreId === null || isFiling}
              />
              {artistTooLong ? (
                <FormHelperText>At most {ARTIST_NAME_MAX_LENGTH} characters</FormHelperText>
              ) : selectedArtist ? (
                <FormHelperText>
                  Filing under {selectedArtist.artist_name} ({selectedArtist.code_letters}{" "}
                  {selectedArtist.code_number})
                </FormHelperText>
              ) : (
                <FormHelperText>
                  Compilations stay out of the bench — file Various Artists releases
                  through the existing album flows instead.
                </FormHelperText>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Album title</FormLabel>
              <Input
                value={albumTitle}
                disabled={isFiling}
                onChange={(e) => setAlbumTitle(e.target.value)}
              />
            </FormControl>

            <Stack direction="row" spacing={1.5}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Label</FormLabel>
                <Input
                  value={label}
                  disabled={isFiling}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Format</FormLabel>
                <Select
                  placeholder="Select format..."
                  value={formatId}
                  disabled={isFiling || formatsUnavailable}
                  onChange={(_, value) => setFormatId(value)}
                >
                  {(formatsQuery.data ?? []).map((format) => (
                    <Option key={format.id} value={format.id}>
                      {format.format_name}
                    </Option>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <CatalogRotationBinPicker
              selectedBin={bin}
              onSelectBin={handleBinChange}
              disabled={isFiling}
            />
            {bin === null && (
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                Library-only filing — no rotation entry will be created.
              </Typography>
            )}

            {bin !== null && (
              <FormControl error={cardConflict}>
                <FormLabel>Card within {ROTATION_BIN_LABELS[bin]}</FormLabel>
                <CardPicker bin={bin} value={cardId} onChange={handleCardChange} />
                {cardConflict && (
                  <Typography level="body-sm" color="danger" role="alert">
                    That card belongs to a different bin — pick one of the{" "}
                    {ROTATION_BIN_LABELS[bin]} cards.
                  </Typography>
                )}
              </FormControl>
            )}

            {bin !== null && (
              <FormControl>
                <FormLabel>URLs</FormLabel>
                <UrlListInput value={urls} onChange={setUrls} />
              </FormControl>
            )}

            {failed && (
              <Typography level="body-sm" color="danger" role="alert">
                Filing failed — nothing was saved. The filing is all-or-nothing, so
                every field above is still exactly what you typed.
              </Typography>
            )}

            <Button color="success" type="submit" loading={isFiling} disabled={!canSubmit}>
              {bin !== null ? "Add to rotation" : "File to library"}
            </Button>
          </Stack>
        </form>
      </Sheet>

      <FiledThisSession filings={filings} />
    </Stack>
  );
}
