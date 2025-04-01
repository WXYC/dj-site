"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { useBin } from "@/src/hooks/binHooks";
import { Inventory } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import DeleteFromBin from "../../Rightbar/Bin/DeleteFromBin";
import AddToBin from "./AddToBin";

export default function AddRemoveBin({ album }: { album: AlbumEntry }) {
  const { bin, loading } = useBin();

  return loading || !bin ? (
    <IconButton loading disabled>
      <Inventory />
    </IconButton>
  ) : bin.find((item) => item.id === album.id) ? (
    <DeleteFromBin album={album} />
  ) : (
    <AddToBin album={album} />
  );
}
