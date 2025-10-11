import { AlbumEntry } from "@/lib/features/catalog/types";
import { useDeleteFromBin } from "@/src/hooks/binHooks";
import { Unarchive } from "@mui/icons-material";
import { IconButton, IconButtonProps, Tooltip } from "@mui/joy";

export default function RemoveFromBin({
  album,
  ...props
}: IconButtonProps & { album: AlbumEntry }) {
  const { deleteFromBin, loading } = useDeleteFromBin();

  return (
    <Tooltip title={`Remove ${album.title} from bin`}>
      <IconButton
        onClick={() => deleteFromBin(album.id)}
        color="warning"
        loading={loading}
        {...props}
      >
        <Unarchive />
      </IconButton>
    </Tooltip>
  );
}

