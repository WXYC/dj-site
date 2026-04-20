"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { useQueue } from "@/src/hooks/flowsheetHooks";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import BinActionMenuItem from "./BinActionMenuItem";

export default function AddToQueueFromBin({ entry }: { entry: AlbumEntry }) {
  const { addToQueue } = useQueue();

  return (
    <BinActionMenuItem
      entry={entry}
      icon={<PlaylistAdd />}
      label="Add to Queue"
      color="success"
      onAction={(entry) => addToQueue(convertBinToQueue(entry))}
    />
  );
}
