"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { DeleteOutline } from "@mui/icons-material";
import { MenuItem, MenuItemProps } from "@mui/joy";

export default function DeleteFromBin({
  album,
  ...props
}: MenuItemProps & { album: AlbumEntry }) {
  const { deleteFromBin } = useDeleteFromBin();

  return (
    <MenuItem onClick={() => deleteFromBin(album.id)} {...props}>
      <DeleteOutline />
      {`Remove ${album.title} from Bin`}
    </MenuItem>
  );
}
