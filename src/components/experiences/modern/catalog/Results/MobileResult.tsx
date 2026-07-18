"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { QueueMusic } from "@mui/icons-material";

import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useRouter } from "next/navigation";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { genreTone } from "@/lib/features/experiences/modern/tokens/roles";
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
  const router = useRouter();

  const genreColor = genreTone(album.artist.genre).color;

  const artistDisplay = album.album_artist ? "Various Artists" : album.artist.name;

  const openDetail = () => router.push(`/dashboard/album/${album.id}`);

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
      {album.artwork_url ? (
        <Box
          component="img"
          src={album.artwork_url}
          alt={`${album.artist.name} - ${album.title}`}
          sx={{ width: 56, height: 56, borderRadius: "sm", objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            width: 56,
            height: 56,
            borderRadius: "sm",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: (theme) =>
              `linear-gradient(135deg, ${theme.vars.palette[genreColor][400]}, ${theme.vars.palette[genreColor][700]})`,
          }}
        >
          <Typography
            level="title-sm"
            sx={{ color: "#fff", opacity: 0.9, fontWeight: 700, letterSpacing: "0.08em" }}
          >
            {album.artist.lettercode}
          </Typography>
        </Box>
      )}

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
