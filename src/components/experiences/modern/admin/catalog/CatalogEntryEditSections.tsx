"use client";

import {
  useGetFormatsQuery,
  useGetGenresQuery,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import type { AlbumEntry, UpdateAlbumRequestBody } from "@/lib/features/catalog/types";
import { useAppDispatch } from "@/lib/hooks";
import type { Rotation } from "@/lib/features/rotation/types";
import { useCatalogRotationMarking } from "@/src/hooks/useCatalogRotationMarking";
import RightbarFormSectionCard from "../../Rightbar/RightbarFormSectionCard";
import CatalogRotationBinPicker from "./CatalogRotationBinPicker";
import CatalogEntryAlbumFields from "./CatalogEntryAlbumFields";
import CatalogEntryArtistAutocomplete from "./CatalogEntryArtistAutocomplete";
import { useCatalogEntryForm } from "./useCatalogEntryForm";
import type { AdminCatalogCodePreviewProps } from "./AdminCatalogCodePreview";
import { FormControl, FormLabel, Option, Select, Stack } from "@mui/joy";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

type CatalogEntryEditSectionsProps = {
  albumId: number;
  album: AlbumEntry;
  onCodePreviewChange?: (preview: AdminCatalogCodePreviewProps) => void;
};

export default function CatalogEntryEditSections({
  albumId,
  album,
  onCodePreviewChange,
}: CatalogEntryEditSectionsProps) {
  const dispatch = useAppDispatch();
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();

  const form = useCatalogEntryForm();
  const hydratedRef = useRef(false);
  const rotation = useCatalogRotationMarking(albumId);

  useEffect(() => {
    hydratedRef.current = false;
  }, [albumId]);

  useEffect(() => {
    return () => {
      dispatch(catalogSlice.actions.clearAlbumRotation(albumId));
    };
  }, [albumId, dispatch]);

  useEffect(() => {
    if (!genres || !formats || hydratedRef.current) return;

    const genreId =
      album.genre_id ??
      genres.find((g) => g.genre_name === album.artist.genre)?.id;
    const formatId =
      album.format_id ??
      formats.find((f) => f.format_name === album.format)?.id;
    const artistId = album.artist_id ?? album.artist.id;

    if (genreId === undefined || formatId === undefined || artistId === undefined) {
      return;
    }

    form.hydrateFromExistingEntry({
      genreId,
      formatId,
      artistId,
      artistName: album.artist.name,
      codeLetters: album.artist.lettercode,
      codeArtistNumber: album.artist.numbercode,
      albumTitle: album.title,
      label: album.label,
      alternateArtist: album.alternate_artist,
      discQuantity: album.disc_quantity ?? 1,
      albumEntry: album.entry,
    });
    hydratedRef.current = true;
  }, [album, genres, formats, form.hydrateFromExistingEntry]);

  const genreDisplay = useMemo(() => {
    if (form.genreIdNum === null) return null;
    return genres?.find((g) => g.id === form.genreIdNum)?.genre_name ?? null;
  }, [form.genreIdNum, genres]);

  const formatDisplay = useMemo(() => {
    if (form.formatIdNum === null) return null;
    return formats?.find((f) => f.id === form.formatIdNum)?.format_name ?? null;
  }, [form.formatIdNum, formats]);

  const codePreview = useMemo<AdminCatalogCodePreviewProps>(
    () => ({
      genreName: genreDisplay,
      codeLetters: form.codeLetters,
      artistNumber: form.codeNumber || null,
      albumEntry: album.entry ?? "?",
      formatLabel: formatDisplay,
      rotation: rotation.selectedBin ?? undefined,
    }),
    [
      genreDisplay,
      form.codeLetters,
      form.codeNumber,
      album.entry,
      formatDisplay,
      rotation.selectedBin,
    ],
  );

  useEffect(() => {
    onCodePreviewChange?.(codePreview);
  }, [codePreview, onCodePreviewChange]);

  const handleRotationSelect = async (bin: Rotation | null) => {
    rotation.setSelectedBin(bin);
    const ok = await rotation.applyRotation(bin);
    if (ok) {
      toast.success(
        bin ? `Marked for ${bin} rotation.` : "Removed from rotation.",
      );
    } else {
      toast.error("Could not update rotation.");
    }
  };

  const onSaveAlbum = async () => {
    if (
      form.genreIdNum === null ||
      form.formatIdNum === null ||
      form.artistId === null ||
      !form.canSaveAlbum
    ) {
      return;
    }

    const title = form.albumTitle.trim();
    const lab = form.label.trim();
    const dq = Math.max(1, parseInt(form.discQuantity, 10) || 1);

    try {
      const body: UpdateAlbumRequestBody = {
        album_title: title,
        label: lab,
        genre_id: form.genreIdNum,
        format_id: form.formatIdNum,
        artist_id: form.artistId,
        disc_quantity: dq,
      };
      if (form.alternateArtist.trim()) {
        body.alternate_artist_name = form.alternateArtist.trim();
      }

      await updateAlbum({ albumId, body }).unwrap();
      const rotationOk = await rotation.applyRotation();
      if (!rotationOk) {
        toast.error("Catalog entry saved, but rotation could not be updated.");
      } else {
        toast.success("Catalog entry updated.");
      }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Could not update catalog entry.");
    }
  };

  if (genresLoading || formatsLoading) {
    return (
      <RightbarFormSectionCard title="Loading edit form" interactive={false}>
        <Stack sx={{ py: 2 }} />
      </RightbarFormSectionCard>
    );
  }

  return (
    <>
      <RightbarFormSectionCard
        title="Artist"
        description="Update genre and artist for this library entry."
        data-testid="catalog-edit-artist-card"
      >
        <FormControl required size="sm">
          <FormLabel>Genre</FormLabel>
          <Select
            size="sm"
            placeholder="Choose genre"
            value={form.genreId}
            onChange={(_, v) => form.setGenreId(v as string)}
            disabled={genresLoading}
          >
            <Option value="">Choose genre</Option>
            {genres?.map((g) => (
              <Option key={g.id} value={String(g.id)}>
                {g.genre_name}
              </Option>
            ))}
          </Select>
        </FormControl>

        <CatalogEntryArtistAutocomplete
          genreIdNum={form.genreIdNum}
          artistMode={form.artistMode}
          inputValue={form.artistInputValue}
          onInputChange={form.handleArtistInputChange}
          value={form.artistOption}
          codeLetters={form.codeLetters}
          codeNumber={form.codeNumber}
          onSelectExisting={form.selectExistingArtist}
          onSelectNew={form.selectNewArtist}
          onClear={form.resetArtist}
          allowCreateArtist={false}
        />
      </RightbarFormSectionCard>

      <RightbarFormSectionCard
        title="Album"
        description="Album details including format and label."
        data-testid="catalog-edit-album-card"
      >
        <CatalogEntryAlbumFields
          disabled={!form.albumSectionUnlocked}
          formatId={form.formatId}
          onFormatIdChange={form.setFormatId}
          formats={formats}
          formatsLoading={formatsLoading}
          albumTitle={form.albumTitle}
          onAlbumTitleChange={form.setAlbumTitle}
          label={form.label}
          onLabelChange={form.setLabel}
          alternateArtist={form.alternateArtist}
          onAlternateArtistChange={form.setAlternateArtist}
          discQuantity={form.discQuantity}
          onDiscQuantityChange={form.setDiscQuantity}
          onAddAlbum={onSaveAlbum}
          adding={saving}
          canAdd={form.canSaveAlbum}
          submitLabel="Save changes"
          submittingLabel="Saving…"
        />
      </RightbarFormSectionCard>

      <RightbarFormSectionCard
        title="Rotation"
        data-testid="catalog-edit-rotation-card"
      >
        <CatalogRotationBinPicker
          selectedBin={rotation.selectedBin}
          onSelectBin={handleRotationSelect}
          disabled={rotation.loading || saving}
          showLabel={false}
        />
      </RightbarFormSectionCard>
    </>
  );
}
