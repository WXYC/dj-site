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
import CatalogEntryFormCard from "@/src/components/experiences/modern/catalog/form/CatalogEntryFormCard";
import CatalogEditContextHero from "@/src/components/experiences/modern/catalog/form/CatalogEditContextHero";
import CatalogFormStepStage from "@/src/components/experiences/modern/catalog/form/CatalogFormStepStage";
import {
  CatalogEditTabNav,
  type CatalogEditTab,
} from "@/src/components/experiences/modern/catalog/form/CatalogEntryFormTabs";
import CatalogEntryArtistSection from "@/src/components/experiences/modern/catalog/form/sections/CatalogEntryArtistSection";
import CatalogEntryAlbumSection from "@/src/components/experiences/modern/catalog/form/sections/CatalogEntryAlbumSection";
import CatalogEntryRotationSection from "@/src/components/experiences/modern/catalog/form/sections/CatalogEntryRotationSection";
import { catalogFormFieldGroupsStackSx } from "@/src/components/experiences/modern/catalog/form/catalogFormLayout";
import type { AdminCatalogCodePreviewProps } from "./AdminCatalogCodePreview";
import { useCatalogEntryForm } from "./useCatalogEntryForm";
import Edit from "@mui/icons-material/Edit";
import { Box, Button, Stack, Tabs } from "@mui/joy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CatalogEntryEditSectionsProps = {
  albumId: number;
  album: AlbumEntry;
  artworkUrl: string;
  onSaveSuccess?: () => void;
};

export default function CatalogEntryEditSections({
  albumId,
  album,
  artworkUrl,
  onSaveSuccess,
}: CatalogEntryEditSectionsProps) {
  const dispatch = useAppDispatch();
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();
  const [activeTab, setActiveTab] = useState<CatalogEditTab>("album");

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

  const onSaveAlbum = useCallback(async () => {
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
        onSaveSuccess?.();
      }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Could not update catalog entry.");
    }
  }, [
    albumId,
    form,
    onSaveSuccess,
    rotation,
    updateAlbum,
  ]);

  if (genresLoading || formatsLoading) {
    return <Stack sx={{ py: 2 }} data-testid="catalog-edit-loading" />;
  }

  const fieldGroups = (
    <Box sx={catalogFormFieldGroupsStackSx}>
      <CatalogFormStepStage
        activeStep={activeTab}
        steps={{
          artist: (
            <div data-testid="catalog-edit-tab-artist">
              <CatalogEntryArtistSection
                form={form}
                genres={genres}
                genresLoading={genresLoading}
                allowCreateArtist={false}
                data-testid="catalog-edit-artist-card"
              />
            </div>
          ),
          album: (
            <div data-testid="catalog-edit-tab-album">
              <CatalogEntryAlbumSection
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
                hideSubmitButton
                pairAlternateAndDisc
                data-testid="catalog-edit-album-card"
              />
            </div>
          ),
          rotation: (
            <div data-testid="catalog-edit-tab-rotation">
              <CatalogEntryRotationSection
                selectedBin={rotation.selectedBin}
                onSelectBin={handleRotationSelect}
                disabled={rotation.loading || saving}
                data-testid="catalog-edit-rotation-card"
              />
            </div>
          ),
        }}
      />
    </Box>
  );

  return (
    <CatalogEntryFormCard
      title="Edit catalog entry"
      titleDecorator={<Edit />}
      headerExtra={
        <CatalogEditContextHero
          album={album}
          artworkUrl={artworkUrl}
          codePreview={codePreview}
        />
      }
      navigation={
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as CatalogEditTab)}
          sx={{ width: "100%" }}
        >
          <CatalogEditTabNav activeTab={activeTab} />
        </Tabs>
      }
      actions={
        <Button
          variant="solid"
          color="primary"
          loading={saving}
          disabled={!form.canSaveAlbum || saving}
          onClick={() => {
            void onSaveAlbum();
          }}
          data-testid="catalog-edit-save-button"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      {fieldGroups}
    </CatalogEntryFormCard>
  );
}
