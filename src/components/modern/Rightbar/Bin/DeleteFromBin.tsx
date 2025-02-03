"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { DeleteOutline } from "@mui/icons-material";
import { IconButton, IconButtonProps, Tooltip } from "@mui/joy";

export default function DeleteFromBin({
  album,
  ...props
}: IconButtonProps & { album: AlbumEntry }) {
  const { deleteFromBin, loading } = useDeleteFromBin();

  return (
    <Tooltip
      title={`Remove ${album.title} from Bin`}
      variant="outlined"
      size="sm"
    >
      <IconButton
        loading={loading}
        onClick={() => deleteFromBin(album.id)}
        {...props}
      >
        <DeleteOutline />
      </IconButton>
    </Tooltip>
  );
}
