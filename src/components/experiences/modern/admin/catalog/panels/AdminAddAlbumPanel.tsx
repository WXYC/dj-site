"use client";

import {
  useAddAlbumMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetInformationQuery,
} from "@/lib/features/catalog/api";
import { applicationSlice } from "@/lib/features/application/frontend";
import type { AddAlbumRequestBody } from "@/lib/features/catalog/types";
import { parseRequiredPositiveInt } from "@/lib/features/catalog/adminCreateArtistValidation";
import { useAppDispatch } from "@/lib/hooks";
import RightbarPanelContainer from "../../../Rightbar/RightbarPanelContainer";
import AdminCatalogCodePreview from "../AdminCatalogCodePreview";
import CatalogEntryPreview from "../CatalogEntryPreview";
import {
  Button,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Stack,
  Typography,
} from "@mui/joy";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function AdminAddAlbumPanel() {
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();
  const [addAlbum, { isLoading: addingAlbum }] = useAddAlbumMutation();

  const [genreId, setGenreId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [label, setLabel] = useState("");
  const [artistName, setArtistName] = useState("");
  const [alternateArtist, setAlternateArtist] = useState("");
  const [discQuantity, setDiscQuantity] = useState("1");
  const [previewAlbumId, setPreviewAlbumId] = useState<number | null>(null);

  const { data: previewEntry } = useGetInformationQuery(
    { album_id: previewAlbumId! },
    { skip: previewAlbumId === null }
  );

  const genreDisplay = useMemo(() => {
    const gid = parseRequiredPositiveInt(genreId);
    if (gid === null) return null;
    return genres?.find((g) => g.id === gid)?.genre_name ?? null;
  }, [genreId, genres]);

  const formatDisplay = useMemo(() => {
    const fid = parseRequiredPositiveInt(formatId);
    if (fid === null) return null;
    return formats?.find((f) => f.id === fid)?.format_name ?? null;
  }, [formatId, formats]);

  const draftLetters = useMemo(() => {
    const t = artistName.trim();
    if (t.length >= 2) return t.slice(0, 2).toUpperCase();
    return "";
  }, [artistName]);

  const onAddAlbum = async () => {
    const gid = parseRequiredPositiveInt(genreId);
    const fid = parseRequiredPositiveInt(formatId);
    const dq = Math.max(1, parseInt(discQuantity, 10) || 1);
    const title = albumTitle.trim();
    const lab = label.trim();

    if (!title || !lab || gid === null || fid === null) {
      toast.error("Album title, label, genre, and format are required.");
      return;
    }
    if (!artistName.trim()) {
      toast.error(
        "Enter an artist name that exists in this genre, or add a new artist first (add menu)."
      );
      return;
    }

    try {
      const body: AddAlbumRequestBody = {
        album_title: title,
        label: lab,
        genre_id: gid,
        format_id: fid,
        disc_quantity: dq,
        artist_name: artistName.trim(),
      };
      if (alternateArtist.trim()) {
        body.alternate_artist_name = alternateArtist.trim();
      }

      const inserted = await addAlbum(body).unwrap();
      const aid = (inserted as { id?: number }).id;
      if (typeof aid === "number") {
        setPreviewAlbumId(aid);
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
      codeLetters={draftLetters}
      artistNumber={null}
      albumEntry="?"
      formatLabel={formatDisplay}
    />
  );

  return (
    <RightbarPanelContainer
      title="Add album"
      subtitle="Catalog encoding preview"
      startDecorator={startDecorator}
      onClose={handleClose}
    >
      <Stack spacing={2}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          The letter code in the preview uses the first two characters of the artist
          name until the library assigns the real code after save.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl sx={{ flex: 1 }} required>
            <FormLabel>Genre</FormLabel>
            <Select
              placeholder="Choose genre"
              value={genreId}
              onChange={(_, v) => setGenreId(v as string)}
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
          <FormControl sx={{ flex: 1 }} required>
            <FormLabel>Format</FormLabel>
            <Select
              placeholder="Choose format"
              value={formatId}
              onChange={(_, v) => setFormatId(v as string)}
              disabled={formatsLoading}
            >
              <Option value="">Choose format</Option>
              {formats?.map((f) => (
                <Option key={f.id} value={String(f.id)}>
                  {f.format_name}
                </Option>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <FormControl required>
          <FormLabel>Album title</FormLabel>
          <Input
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
          />
        </FormControl>

        <FormControl required>
          <FormLabel>Label</FormLabel>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormLabel>Artist name</FormLabel>
          <Input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Must match an existing artist in this genre"
          />
        </FormControl>

        <FormControl>
          <FormLabel>Alternate artist display (optional)</FormLabel>
          <Input
            value={alternateArtist}
            onChange={(e) => setAlternateArtist(e.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Disc quantity</FormLabel>
          <Input
            type="number"
            slotProps={{ input: { min: 1 } }}
            value={discQuantity}
            onChange={(e) => setDiscQuantity(e.target.value)}
          />
        </FormControl>

        <Button
          loading={addingAlbum}
          onClick={onAddAlbum}
          variant="solid"
          color="primary"
        >
          Add album to catalog
        </Button>

        {previewEntry && previewAlbumId !== null && (
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
