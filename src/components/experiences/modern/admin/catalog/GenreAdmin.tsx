"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  List,
  ListItem,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAddGenreMutation, useGetGenresQuery } from "@/lib/features/catalog/api";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

function GenreAdmin() {
  const { data: genres } = useGetGenresQuery();
  const [addGenre, { isLoading }] = useAddGenreMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName || !trimmedDescription) {
      toast.error(
        !trimmedName ? "Genre name can't be blank" : "Genre description can't be blank"
      );
      return;
    }

    try {
      await addGenre({ name: trimmedName, description: trimmedDescription }).unwrap();
      setName("");
      setDescription("");
    } catch (err) {
      // The global rtkQueryErrorLogger middleware already toasts the server
      // message for the common failure (e.g. a 409 duplicate-name reply);
      // only surface a fallback here for the gap it leaves silent.
      if (isUnmessagedHttpError(err)) {
        toast.error("Failed to add genre");
      }
    }
  };

  return (
    <RequireMD>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Typography level="title-md" sx={{ mb: 1 }}>
          Genres
        </Typography>
        <List size="sm" sx={{ mb: 2 }}>
          {(genres ?? []).map((genre) => (
            <ListItem key={genre.id}>{genre.genre_name}</ListItem>
          ))}
        </List>
        <form onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <FormControl>
              <FormLabel>Genre name</FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shoegaze"
                required
              />
            </FormControl>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Wall-of-sound guitar textures"
                required
              />
            </FormControl>
            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" loading={isLoading}>
                Add Genre
              </Button>
            </Stack>
          </Stack>
        </form>
      </Sheet>
    </RequireMD>
  );
}

export default GenreAdmin;
