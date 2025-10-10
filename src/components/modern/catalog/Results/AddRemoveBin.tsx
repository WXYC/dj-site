"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { useBin } from "@/src/hooks/binHooks";
import { Archive } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import AddToBin from "./AddToBin";
import RemoveFromBin from "./RemoveFromBin";

export default function AddRemoveBin({ album }: { album: AlbumEntry }) {
  const { bin, loading } = useBin();

  return loading || !bin ? (
    <IconButton loading disabled>
      <Archive />
    </IconButton>
  ) : bin.find((item) => item.id === album.id) ? (
    <RemoveFromBin album={album} />
  ) : (
    <AddToBin album={album} />
  );
}
