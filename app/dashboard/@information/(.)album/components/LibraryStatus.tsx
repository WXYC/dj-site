"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import {
  useMarkFoundMutation,
  useMarkMissingMutation,
} from "@/lib/features/catalog/api";
import { Button, Chip, Stack } from "@mui/joy";

interface LibraryStatusProps {
  album: AlbumEntry;
}

export default function LibraryStatus({ album }: LibraryStatusProps) {
  const [markMissing] = useMarkMissingMutation();
  const [markFound] = useMarkFoundMutation();

  const isMissing =
    album.date_lost &&
    (!album.date_found ||
      new Date(album.date_found) < new Date(album.date_lost));

  if (isMissing) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip color="danger" size="sm">
          Missing since {new Date(album.date_lost!).toLocaleDateString()}
        </Chip>
        <Button
          size="sm"
          variant="outlined"
          color="success"
          onClick={() => markFound({ albumId: album.id })}
        >
          Mark Found
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip color="success" size="sm">
        In Library
      </Chip>
      <Button
        size="sm"
        variant="outlined"
        color="danger"
        onClick={() => markMissing({ albumId: album.id })}
      >
        Mark Missing
      </Button>
    </Stack>
  );
}
