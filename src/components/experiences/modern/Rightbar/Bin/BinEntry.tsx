import { AlbumEntry } from "@/lib/features/catalog/types";
import { Stack } from "@mui/joy";

import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import BinMenu from "./BinMenu";
import ScrollOnHoverText from "./ScrollOnHoverText";

export default function BinEntry({ entry }: { entry: AlbumEntry }) {
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
      <BinMenu entry={entry} />
    </Stack>
  );
}
