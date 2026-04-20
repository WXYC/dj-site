"use client";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { convertBinToFlowsheet } from "@/lib/features/bin/conversions";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { PlayArrowOutlined } from "@mui/icons-material";
import BinActionMenuItem from "./BinActionMenuItem";

export default function PlayFromBin({ entry }: { entry: AlbumEntry }) {
  const { addToFlowsheet } = useFlowsheet();

  return (
    <BinActionMenuItem
      entry={entry}
      icon={<PlayArrowOutlined />}
      label="Play Now"
      color="primary"
      onAction={(entry) => addToFlowsheet(convertBinToFlowsheet(entry))}
    />
  );
}
