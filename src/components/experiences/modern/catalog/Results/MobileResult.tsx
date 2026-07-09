"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { QueueMusic } from "@mui/icons-material";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { useQueue, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useAppDispatch } from "@/lib/hooks";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { GENRE_COLORS } from "../ArtistAvatar";
import AddRemoveBin from "./AddRemoveBin";
import { MatchedTrackChips } from "./MatchedTrackChips";
import { ReleaseChips } from "./ReleaseChips";
import { toast } from "sonner";

// Below the `sm` breakpoint the desktop table is hidden and the results
// render as this Apple-Music-style stacked card instead: artwork on the
// left, everything else stacked vertically, actions trailing.
export default function CatalogMobileResult({ album }: { album: AlbumEntry }) {
  const { live } = useShowControl();
  const { addToQueue } = useQueue();
  const dispatch = useAppDispatch();

  const { selected, setSelection } = useCatalogQuerySearch();

  const genreColor = GENRE_COLORS[(album.artist.genre as Genre) ?? "Unknown"] ?? "neutral";
  const isSelected = selected.includes(album.id);

  const artistDisplay = album.album_artist ? "Various Artists" : album.artist.name;

  const openDetail = () =>
    dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: album.id }));

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
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.25,
        borderRadius: "md",
        bgcolor: isSelected ? "background.level2" : "background.level1",
        cursor: "pointer",
      }}
    >
      <Checkbox
        checked={isSelected}
        color={isSelected ? "primary" : undefined}
        onClick={(e) => e.stopPropagation()}
        onChange={(event) => {
          setSelection(
            event.target.checked
              ? [...selected, album.id]
              : selected.filter((item) => item !== album.id)
          );
        }}
        sx={{ flexShrink: 0 }}
      />
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
        <Typography level="title-sm" textColor="text.primary" noWrap title={album.title}>
          {album.title}
        </Typography>
        <Typography level="body-sm" textColor="text.secondary" noWrap title={artistDisplay}>
          {artistDisplay}
        </Typography>
        <MatchedTrackChips matched_via={album.matched_via} />
        <ReleaseChips
          genre={album.artist.genre}
          format={album.format}
          rotation={album.rotation_bin}
          onStreaming={album.on_streaming}
        />
        <Typography level="body-xs" textColor="text.tertiary" noWrap sx={{ mt: 0.25 }}>
          {meta}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        gap={0.25}
        alignItems="center"
        sx={{ flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          aria-label="More information"
          variant="plain"
          color="neutral"
          size="sm"
          onClick={openDetail}
        >
          <InfoOutlinedIcon />
        </IconButton>
        {live && (
          <IconButton
            aria-label="Add to Queue"
            variant="plain"
            color="neutral"
            size="sm"
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
