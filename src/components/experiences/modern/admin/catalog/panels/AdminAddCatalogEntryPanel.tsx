"use client";

import {
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetInformationQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { AddAlbumRequestBody } from "@/lib/features/catalog/types";
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";
import { useAppDispatch } from "@/lib/hooks";
import RightbarPanelContainer from "../../../Rightbar/RightbarPanelContainer";
import AdminCatalogCodePreview from "../AdminCatalogCodePreview";
import CatalogEntryPreview from "../CatalogEntryPreview";
import CatalogEntryAlbumFields from "../CatalogEntryAlbumFields";
import CatalogEntryArtistAutocomplete from "../CatalogEntryArtistAutocomplete";
import CatalogEntryNewArtistFields from "../CatalogEntryNewArtistFields";
import { useCatalogEntryForm } from "../useCatalogEntryForm";
import {
  Divider,
  FormControl,
  FormLabel,
  Option,
  Select,
  Stack,
  Typography,
} from "@mui/joy";
import { useMemo } from "react";
import { toast } from "sonner";

export default function AdminAddCatalogEntryPanel() {
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const [addArtist, { isLoading: addingArtist }] = useAddArtistMutation();
  const [addAlbum, { isLoading: addingAlbum }] = useAddAlbumMutation();
  const [peekTrigger] = useLazyPeekArtistCodeQuery();

  const form = useCatalogEntryForm();

  const { data: previewEntry } = useGetInformationQuery(
    { album_id: form.previewAlbumId! },
    { skip: form.previewAlbumId === null }
  );

  const genreDisplay = useMemo(() => {
    if (form.genreIdNum === null) return null;
    return genres?.find((g) => g.id === form.genreIdNum)?.genre_name ?? null;
  }, [form.genreIdNum, genres]);

  const formatDisplay = useMemo(() => {
    if (form.formatIdNum === null) return null;
    return formats?.find((f) => f.id === form.formatIdNum)?.format_name ?? null;
  }, [form.formatIdNum, formats]);

  const onSuggestArtistCode = async () => {
    if (form.genreIdNum === null) return;
    const letters = form.codeLetters.trim().toUpperCase();
    if (!letters) {
      toast.error("Enter code letters first.");
      return;
    }
    try {
      const res = await peekTrigger({
        code_letters: letters,
        genre_id: form.genreIdNum,
      }).unwrap();
      form.setCodeNumber(String(res.next_code_number));
      toast.success(`Suggested artist #${res.next_code_number}`);
    } catch {
      toast.error("Could not peek next artist code.");
    }
  };

  const onCreateArtist = async () => {
    if (form.genreIdNum === null || !form.canCreateArtist) return;
    const num = parseRequiredPositiveInt(form.codeNumber);
    const letters = form.codeLetters.trim().toUpperCase();
    const name = form.newArtistName;
    if (!name || !letters || num === null) return;

    try {
      const res = await addArtist({
        artist_name: name,
        alphabetical_name: form.alphabeticalName.trim() || undefined,
        code_letters: letters,
        genre_id: form.genreIdNum,
        code_number: num,
      }).unwrap();
      const id = (res as { id?: number }).id;
      if (typeof id === "number") {
        form.markArtistCreated(id);
        toast.success("Artist created. You can add an album below.");
      }
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        data?: { message?: string; artist?: { artist_id: number } };
      };
      if (e?.status === 409 && e?.data?.artist?.artist_id) {
        form.markArtistCreated(e.data.artist.artist_id);
        toast.info(
          "That artist code already exists — using the existing artist record."
        );
        return;
      }
      toast.error(e?.data?.message || "Could not create artist.");
    }
  };

  const onAddAlbum = async () => {
    if (
      form.genreIdNum === null ||
      form.formatIdNum === null ||
      form.artistId === null ||
      !form.canAddAlbum
    ) {
      return;
    }
    const title = form.albumTitle.trim();
    const lab = form.label.trim();
    const dq = Math.max(1, parseInt(form.discQuantity, 10) || 1);

    try {
      const body: AddAlbumRequestBody = {
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

      const inserted = await addAlbum(body).unwrap();
      const aid = (inserted as { id?: number }).id;
      if (typeof aid === "number") {
        form.setPreviewAlbumId(aid);
        toast.success("Album added to the catalog.");
      }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e?.data?.message || "Could not add album.");
    }
  };

  const startDecorator = (
    <AdminCatalogCodePreview
      genreName={genreDisplay}
      codeLetters={form.codeLetters}
      artistNumber={form.codeNumber || null}
      albumEntry="?"
      formatLabel={formatDisplay}
    />
  );

  return (
    <RightbarPanelContainer
      title="Add to catalog"
      subtitle="Genre and artist, then album"
      startDecorator={startDecorator}
      onClose={handleClose}
    >
      <Stack spacing={2}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Choose a genre, then find or create an artist. Album fields (including
          format) unlock after the artist exists in that genre.
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
        />

        {form.showNewArtistFields && (
          <CatalogEntryNewArtistFields
            codeLetters={form.codeLetters}
            onCodeLettersChange={form.setCodeLetters}
            codeNumber={form.codeNumber}
            onCodeNumberChange={form.setCodeNumber}
            alphabeticalName={form.alphabeticalName}
            onAlphabeticalNameChange={form.setAlphabeticalName}
            onSuggestNext={onSuggestArtistCode}
            onCreateArtist={onCreateArtist}
            creating={addingArtist}
            canCreate={form.canCreateArtist}
            locked={form.codeFieldsLocked}
          />
        )}

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
          onAddAlbum={onAddAlbum}
          adding={addingAlbum}
          canAdd={form.canAddAlbum}
        />

        {previewEntry && form.previewAlbumId !== null && (
          <>
            <Divider />
            <Typography level="title-sm">Saved — library encoding</Typography>
            <CatalogEntryPreview entry={previewEntry} />
          </>
        )}
      </Stack>
    </RightbarPanelContainer>
  );
}
