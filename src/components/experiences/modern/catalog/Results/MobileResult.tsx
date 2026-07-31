"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { QueueMusic } from "@mui/icons-material";

import { applicationSlice } from "@/lib/features/application/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { AlbumArtwork } from "../AlbumArtwork";
import AddRemoveBin from "./AddRemoveBin";
import { MatchedTrackChips } from "./MatchedTrackChips";
import { ReleaseChips } from "./ReleaseChips";
import { toast } from "sonner";
import { memo } from "react";

// Rendered below the `sm` breakpoint in place of the desktop table.
// `live`/`addToQueue` are hoisted into Results (shared across rows); memoized
// so a query keystroke doesn't re-render unchanged cards.
function CatalogMobileResult({
  album,
  live,
  addToQueue,
}: {
  album: AlbumEntry;
  live: boolean;
  addToQueue: (entry: FlowsheetQuery) => void;
}) {
  const dispatch = useAppDispatch();

  const artistDisplay = album.album_artist ? "Various Artists" : album.artist.name;

  const openDetail = () =>
    dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: album.id }));

  // The actions sit in the top-right corner, so only the top text lines
  // (title, artist) need to reserve room for them; everything below runs
  // full width. Three compact icons when live, two otherwise.
  const actionClearance = live ? "92px" : "62px";

  const meta = [
    `${album.artist.lettercode} ${album.artist.numbercode}/${album.entry}`,
    album.plays != null && album.plays > 0 ? `${album.plays} plays` : null,
    album.label || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      variant="soft"
      onClick={openDetail}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.25,
        borderRadius: "md",
        bgcolor: "background.level1",
        cursor: "pointer",
      }}
    >
      <AlbumArtwork album={album} size={56} />

      <Stack sx={{ flex: 1, minWidth: 0 }} gap={0.25}>
        <Typography
          level="title-sm"
          textColor="text.primary"
          noWrap
          title={album.title}
          sx={{ pr: actionClearance }}
        >
          {album.title}
        </Typography>
        <Typography
          level="body-sm"
          textColor="text.secondary"
          noWrap
          title={artistDisplay}
          sx={{ pr: actionClearance }}
        >
          {artistDisplay}
        </Typography>
        <MatchedTrackChips matched_via={album.matched_via} />
        {/* Pills share the metadata line with the call number / plays /
            label to keep the card compact. */}
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          flexWrap="wrap"
          sx={{ mt: 0.25 }}
        >
          <ReleaseChips
            genre={album.artist.genre}
            format={album.format}
            rotation={album.rotation_bin}
            onStreaming={album.on_streaming}
          />
          <Typography level="body-xs" textColor="text.tertiary">
            {meta}
          </Typography>
        </Stack>
      </Stack>

      <Stack
        direction="row"
        gap={0.25}
        alignItems="center"
        sx={{
          position: "absolute",
          top: 6,
          right: 6,
          "--IconButton-size": "28px",
          "--Icon-fontSize": "18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          aria-label="More information"
          variant="plain"
          color="neutral"
          onClick={openDetail}
        >
          <InfoOutlinedIcon />
        </IconButton>
        {live && (
          <IconButton
            aria-label="Add to Queue"
            variant="plain"
            color="neutral"
            onClick={() => {
              addToQueue(convertBinToQueue(album));
              toast.success(`Added ${album.title} to queue`);
            }}
          >
            <QueueMusic />
          </IconButton>
        )}
        <AddRemoveBin album={album} />
      </Stack>
    </Sheet>
  );
}

export default memo(CatalogMobileResult);
