"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import {
  useMarkFoundMutation,
  useMarkMissingMutation,
} from "@/lib/features/catalog/api";
import { Chip, Stack } from "@mui/joy";
import { RequireMD } from "@/src/components/shared/Authorization";

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

  // The status chip (In Library / Missing since ...) is informational and
  // stays visible to every DJ; only the write action next to it — the thing
  // that actually mutates library state — is MD-gated.
  if (isMissing) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip color="danger" size="sm">
          Missing since {new Date(album.date_lost!).toLocaleDateString()}
        </Chip>
        <RequireMD>
          <Chip
            size="sm"
            variant="outlined"
            color="success"
            onClick={() => markFound({ albumId: album.id })}
            sx={{ cursor: "pointer" }}
          >
            Mark Found
          </Chip>
        </RequireMD>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip color="success" size="sm">
        In Library
      </Chip>
      <RequireMD>
        <Chip
          size="sm"
          variant="outlined"
          color="danger"
          onClick={() => markMissing({ albumId: album.id })}
          sx={{ cursor: "pointer" }}
        >
          Mark Missing
        </Chip>
      </RequireMD>
    </Stack>
  );
}
