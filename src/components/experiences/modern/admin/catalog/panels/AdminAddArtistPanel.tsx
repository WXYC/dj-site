"use client";

import {
  useAddArtistMutation,
  useGetGenresQuery,
  useLazyPeekArtistCodeQuery,
} from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import {
  adminCreateArtistFieldValid,
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type { AdminCreateArtistFieldKey } from "@/lib/features/catalog/types";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import RightbarPanelContainer from "../../../Rightbar/RightbarPanelContainer";
import AdminCatalogCodePreview from "../AdminCatalogCodePreview";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Stack,
  Typography,
} from "@mui/joy";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const FIELDS: AdminCreateArtistFieldKey[] = [
  "codeLetters",
  "codeNumber",
  "newArtistName",
  "genreSelected",
];

export default function AdminAddArtistPanel() {
  const dispatch = useAppDispatch();
  const createArtistFormComplete = useAppSelector(
    catalogSlice.selectors.adminCreateArtistFormComplete
  );
  const { data: genres, isLoading: genresLoading } = useGetGenresQuery();
  const [addArtist, { isLoading: addingArtist }] = useAddArtistMutation();
  const [peekTrigger] = useLazyPeekArtistCodeQuery();

  const [genreId, setGenreId] = useState("");
  const [codeLetters, setCodeLetters] = useState("");
  const [codeNumber, setCodeNumber] = useState("");
  const [newArtistName, setNewArtistName] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");

  const handleClose = () => dispatch(applicationSlice.actions.closePanel());

  useEffect(() => {
    dispatch(catalogSlice.actions.resetAdminCreateArtist());
    return () => {
      dispatch(catalogSlice.actions.resetAdminCreateArtist());
    };
  }, [dispatch]);

  useEffect(() => {
    const values = {
      codeLetters,
      codeNumber,
      newArtistName,
      genreId,
    };
    for (const key of FIELDS) {
      dispatch(
        catalogSlice.actions.verifyAdminCreateArtist({
          key,
          value: adminCreateArtistFieldValid(key, values),
        })
      );
    }
  }, [codeLetters, codeNumber, newArtistName, genreId, dispatch]);

  const genreDisplay = useMemo(() => {
    const gid = parseRequiredPositiveInt(genreId);
    if (gid === null) return null;
    return genres?.find((g) => g.id === gid)?.genre_name ?? null;
  }, [genreId, genres]);

  const onSuggestArtistCode = async () => {
    const gid = parseRequiredPositiveInt(genreId);
    const letters = codeLetters.trim().toUpperCase();
    if (!letters || gid === null) {
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
    const gid = parseRequiredPositiveInt(genreId);
    const num = parseRequiredPositiveInt(codeNumber);
    const name = newArtistName.trim();
    const letters = codeLetters.trim().toUpperCase();
    if (!name || !letters || gid === null || num === null) {
      toast.error(
        "Fill artist name, code letters, artist #, and choose a genre."
      );
      return;
    }
    try {
      await addArtist({
        artist_name: name,
        alphabetical_name: alphabeticalName.trim() || undefined,
        code_letters: letters,
        genre_id: gid,
        code_number: num,
      }).unwrap();
      toast.success("Artist created.");
      handleClose();
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        data?: { message?: string; artist?: { id: number } };
      };
      if (e?.status === 409 && e?.data?.artist?.id) {
        toast.info(
          "That artist code already exists — using the existing artist record."
        );
        handleClose();
        return;
      }
      toast.error(e?.data?.message || "Could not create artist.");
    }
  };

  const startDecorator = (
    <AdminCatalogCodePreview
      genreName={genreDisplay}
      codeLetters={codeLetters}
      artistNumber={codeNumber || null}
      albumEntry="?"
      formatLabel={null}
    />
  );

  return (
    <RightbarPanelContainer
      title="Add artist"
      subtitle="Letter code and genre"
      startDecorator={startDecorator}
      onClose={handleClose}
    >
      <Stack spacing={2}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Choose genre, set letter code (e.g. RO), then use Suggest next # for
          the next artist number in that genre.
        </Typography>

        <FormControl required>
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
          variant="solid"
          color="primary"
          disabled={addingArtist || !createArtistFormComplete}
        >
          Create artist
        </Button>
      </Stack>
    </RightbarPanelContainer>
  );
}
