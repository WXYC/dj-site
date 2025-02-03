import { AlbumEntry } from "@/lib/features/catalog/types";
import { Button, Stack, Tooltip } from "@mui/joy";

import { LinkButton } from "@/src/components/General/LinkButton";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import PlaylistAdd from "@mui/icons-material/PlaylistAdd";
import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import DeleteFromBin from "./DeleteFromBin";
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
          level="body-sm"
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
        <Tooltip title="More Info" variant="outlined" size="sm">
          <LinkButton
            href={`/dashboard/album/${entry.id}`}
            size="sm"
            variant="plain"
            color="neutral"
          >
            <InfoOutlined />
          </LinkButton>
        </Tooltip>
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
        <DeleteFromBin
          album={entry}
          size="sm"
          variant="plain"
          color="warning"
        />
      </Stack>
    </Stack>
  );
}
