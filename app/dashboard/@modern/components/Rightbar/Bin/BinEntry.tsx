import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Button, Stack, Tooltip } from "@mui/joy";

import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import Link from "next/link";
import { ArtistAvatar } from "../../../catalog/components/ArtistAvatar";
import ScrollOnHoverText from "./ScrollOnHoverText";

export default function BinEntry({ entry }: { entry: AlbumEntry }) {
  const live: boolean = false;

  return (
    <Stack
      key={`bin-stack-${entry.id}`}
      direction="row"
      spacing={2}
      sx={{
        mt: 1,
        mb: 1,
        justifyContent: "space-between",
        maxWidth: "100%",
      }}
    >
      <ArtistAvatar
        entry={entry.entry}
        artist={entry.artist}
        format={entry.format}
      />
      <div>
        <ScrollOnHoverText
          key={`bin-${entry.id}-name`}
          level="body-md"
          width={{ sm: 89, lg: 189 }}
        >
          {entry.artist.name}
        </ScrollOnHoverText>
        <ScrollOnHoverText
          key={`bin-${entry.id}-title`}
          level="body-md"
          width={{ sm: 89, lg: 189 }}
        >
          {entry.title}
        </ScrollOnHoverText>
      </div>
      <Stack direction="row">
        <Box>
        <Tooltip title="More Info" variant="outlined" size="sm">
          <Link href={`/dashboard/album/${entry.id}`}>
            <Button size="sm" variant="plain" color="neutral">
              <InfoOutlined />
            </Button>
          </Link>
        </Tooltip>
        </Box>
        {live && (
          <Tooltip
            title="Add to Queue"
            placement="bottom"
            variant="outlined"
            size="sm"
          >
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => console.log("Adds to queue")}
            >
              <PlaylistAdd />
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Remove" variant="outlined" size="sm">
          <Button
            size="sm"
            variant="plain"
            color="warning"
            onClick={() => console.log("Removes from bin")}
          >
            <DeleteOutlineOutlined />
          </Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
