"use client";

import {
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetInformationQuery,
  useUpdateAlbumMutation,
} from "@/lib/features/catalog/api";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { UpdateAlbumRequestBody } from "@/lib/features/catalog/types";
import { useAppDispatch } from "@/lib/hooks";
import RightbarPanelContainer from "../../../Rightbar/RightbarPanelContainer";
import AdminCatalogCodePreview from "../AdminCatalogCodePreview";
import CatalogEntryAlbumFields from "../CatalogEntryAlbumFields";
import CatalogEntryArtistAutocomplete from "../CatalogEntryArtistAutocomplete";
import { useCatalogEntryForm } from "../useCatalogEntryForm";
import {
  CircularProgress,
  Divider,
  FormControl,
  FormLabel,
  Option,
  Select,
  Stack,
  Typography,
} from "@mui/joy";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

type AdminEditCatalogEntryPanelProps = {
  albumId: number;
};

export default function AdminEditCatalogEntryPanel({
  albumId,
}: AdminEditCatalogEntryPanelProps) {
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const {
    data: album,
    isLoading: albumLoading,
    isError: albumError,
  } = useGetInformationQuery({ album_id: albumId });
  const [updateAlbum, { isLoading: saving }] = useUpdateAlbumMutation();

  const form = useCatalogEntryForm();
  const hydratedRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = false;
  }, [albumId]);

  useEffect(() => {
    if (!album || !genres || !formats || hydratedRef.current) return;

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
      toast.success("Catalog entry updated.");
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Could not update catalog entry.");
    }
  };

  const startDecorator = (
    <AdminCatalogCodePreview
      genreName={genreDisplay}
      codeLetters={form.codeLetters}
      artistNumber={form.codeNumber || null}
      albumEntry={album?.entry ?? "?"}
      formatLabel={formatDisplay}
    />
  );

  if (albumLoading || genresLoading || formatsLoading) {
    return (
      <RightbarPanelContainer title="Edit catalog entry" onClose={handleClose}>
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      </RightbarPanelContainer>
    );
  }

  if (albumError || !album) {
    return (
      <RightbarPanelContainer title="Edit catalog entry" onClose={handleClose}>
        <Typography level="body-sm" color="danger">
          Could not load this catalog entry.
        </Typography>
      </RightbarPanelContainer>
    );
  }

  return (
    <RightbarPanelContainer
      title="Edit catalog entry"
      subtitle={`${album.artist.name} — ${album.title}`}
      startDecorator={startDecorator}
      onClose={handleClose}
    >
      <Stack spacing={2}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Update genre and artist for this library entry, then album details
          (including format). The catalog code (entry number) stays the same.
        </Typography>

        <FormControl required>
          <FormLabel>Genre</FormLabel>
          <Select
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
          inputValue={form.artistInputValue}
          onInputChange={form.setArtistInputValue}
          value={form.artistOption}
          onSelectExisting={form.selectExistingArtist}
          onSelectNew={form.selectNewArtist}
          onClear={form.resetArtist}
          allowCreateArtist={false}
        />

        <Divider />
        <Typography level="title-sm">Album</Typography>

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
      </Stack>
    </RightbarPanelContainer>
  );
}
