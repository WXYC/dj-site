"use client";

import {
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetFormatsQuery,
  useGetGenresQuery,
  useGetInformationQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import type { AddAlbumRequestBody } from "@/lib/features/catalog/types";
import CatalogEntryPreview from "./CatalogEntryPreview";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import { ExpandMore } from "@mui/icons-material";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminCatalogForm() {
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const { data: formats, isLoading: formatsLoading } = useGetFormatsQuery();

  const [addAlbum, { isLoading: addingAlbum }] = useAddAlbumMutation();
  const [addArtist, { isLoading: addingArtist }] = useAddArtistMutation();
  const [peekTrigger] = useLazyPeekArtistCodeQuery();

  const [genreId, setGenreId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [albumTitle, setAlbumTitle] = useState("");
  const [label, setLabel] = useState("");
  const [artistName, setArtistName] = useState("");
  const [alternateArtist, setAlternateArtist] = useState("");
  const [discQuantity, setDiscQuantity] = useState("1");

  const [codeLetters, setCodeLetters] = useState("");
  const [codeNumber, setCodeNumber] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");

  const [resolvedArtistId, setResolvedArtistId] = useState<number | null>(null);
  const [previewAlbumId, setPreviewAlbumId] = useState<number | null>(null);

  const { data: previewEntry } = useGetInformationQuery(
    { album_id: previewAlbumId! },
    { skip: previewAlbumId === null }
  );

  const onSuggestArtistCode = async () => {
    const gid = Number(genreId);
    const letters = codeLetters.trim().toUpperCase();
    if (!letters || !Number.isFinite(gid)) {
      toast.error("Enter code letters and select a genre first.");
      return;
    }
    try {
      const res = await peekTrigger({
        code_letters: letters,
        genre_id: gid,
      }).unwrap();
      setCodeNumber(String(res.next_code_number));
      toast.success(`Suggested artist #${res.next_code_number}`);
    } catch {
      toast.error("Could not peek next artist code.");
    }
  };

  const onCreateArtist = async () => {
    const gid = Number(genreId);
    const num = Number(codeNumber);
    const name = newArtistName.trim();
    const letters = codeLetters.trim().toUpperCase();
    if (!name || !letters || !Number.isFinite(gid) || !Number.isFinite(num)) {
      toast.error("Fill artist name, code letters, genre, and artist #.");
      return;
    }
    try {
      const created = await addArtist({
        artist_name: name,
        alphabetical_name: alphabeticalName.trim() || undefined,
        code_letters: letters,
        genre_id: gid,
        code_number: num,
      }).unwrap();
      const id = (created as { id?: number }).id;
      if (typeof id === "number") {
        setResolvedArtistId(id);
        setArtistName(name);
        toast.success("Artist created. You can add the album below.");
      }
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { message?: string; artist?: { id: number } } };
      if (e?.status === 409 && e?.data?.artist?.id) {
        setResolvedArtistId(e.data.artist.id);
        setArtistName(newArtistName.trim());
        toast.info(
          "That artist code already exists — using the existing artist record."
        );
        return;
      }
      const msg = e?.data?.message || "Could not create artist.";
      toast.error(msg);
    }
  };

  const onAddAlbum = async () => {
    const gid = Number(genreId);
    const fid = Number(formatId);
    const dq = Math.max(1, parseInt(discQuantity, 10) || 1);
    const title = albumTitle.trim();
    const lab = label.trim();

    if (!title || !lab || !Number.isFinite(gid) || !Number.isFinite(fid)) {
      toast.error("Album title, label, genre, and format are required.");
      return;
    }
    if (resolvedArtistId == null && !artistName.trim()) {
      toast.error("Enter an artist name (existing library artist) or create a new artist first.");
      return;
    }

    try {
      const body: AddAlbumRequestBody = {
        album_title: title,
        label: lab,
        genre_id: gid,
        format_id: fid,
        disc_quantity: dq,
      };
      if (alternateArtist.trim()) {
        body.alternate_artist_name = alternateArtist.trim();
      }
      if (resolvedArtistId != null) {
        body.artist_id = resolvedArtistId;
      } else {
        body.artist_name = artistName.trim();
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

  const clearArtistResolution = () => {
    setResolvedArtistId(null);
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Typography level="body-md">
        Add albums to the card catalog. The catalog code (genre, letter code, artist
        number, album number) is assigned by the library when you save. Choose format
        and disc count to match vinyl/CD and multi-disc releases.
      </Typography>

      <Accordion defaultExpanded={false}>
        <AccordionSummary indicator={<ExpandMore />}>
          <Typography level="title-md">Register a new artist (optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Use this when the artist does not exist in the genre yet. You need the
              letter code (e.g. RO) and the next artist number — use &quot;Suggest next
              #&quot; after picking genre and letters.
            </Typography>
            <FormControl>
              <FormLabel>Code letters</FormLabel>
              <Input
                value={codeLetters}
                onChange={(e) => setCodeLetters(e.target.value)}
                placeholder="e.g. RO"
              />
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Artist #</FormLabel>
                <Input
                  value={codeNumber}
                  onChange={(e) => setCodeNumber(e.target.value)}
                  placeholder="number"
                />
              </FormControl>
              <Button
                variant="outlined"
                onClick={onSuggestArtistCode}
                sx={{ alignSelf: { sm: "flex-end" }, mt: { sm: 2.5 } }}
              >
                Suggest next #
              </Button>
            </Stack>
            <FormControl>
              <FormLabel>New artist name</FormLabel>
              <Input
                value={newArtistName}
                onChange={(e) => setNewArtistName(e.target.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Alphabetical sort name (optional)</FormLabel>
              <Input
                value={alphabeticalName}
                onChange={(e) => setAlphabeticalName(e.target.value)}
              />
            </FormControl>
            <Button
              loading={addingArtist}
              onClick={onCreateArtist}
              variant="soft"
            >
              Create artist
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Divider />

      <Typography level="title-lg">Album</Typography>

      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl sx={{ flex: 1 }} required>
            <FormLabel>Genre</FormLabel>
            <Select
              placeholder="Choose genre"
              value={genreId}
              onChange={(_, v) => {
                setGenreId(v as string);
                clearArtistResolution();
              }}
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
          <FormLabel>
            Artist name{" "}
            {resolvedArtistId != null && (
              <Typography component="span" level="body-xs" sx={{ color: "success.600" }}>
                (linked to new artist id {resolvedArtistId})
              </Typography>
            )}
          </FormLabel>
          <Input
            value={artistName}
            onChange={(e) => {
              setArtistName(e.target.value);
              clearArtistResolution();
            }}
            placeholder="Must match an existing artist in this genre, unless you created one above"
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

        <Button loading={addingAlbum} onClick={onAddAlbum}>
          Add album to catalog
        </Button>
      </Stack>

      {previewEntry && previewAlbumId !== null && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Typography level="title-md">Preview (library encoding)</Typography>
          <CatalogEntryPreview entry={previewEntry} />
        </Stack>
      )}
    </Stack>
  );
}
