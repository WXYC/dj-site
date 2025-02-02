import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAddToBin } from "@/src/hooks/binHooks";
import { Inventory } from "@mui/icons-material";
import { IconButton, IconButtonProps, Tooltip } from "@mui/joy";

export default function AddToBin({
  album,
  ...props
}: IconButtonProps & { album: AlbumEntry }) {
  const { addToBin, loading: binLoading } = useAddToBin();

  return (
    <Tooltip title={`Add ${album.title} to bin`}>
      <IconButton
        onClick={() => addToBin(album.id)}
        loading={binLoading}
        {...props}
      >
        <Inventory />
      </IconButton>
    </Tooltip>
  );
}
