"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";

import { Album as AlbumIcon } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Avatar, Stack, Tooltip } from "@mui/joy";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { QueueMusic } from "@mui/icons-material";
import { useQueue, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useAppDispatch } from "@/lib/hooks";
import { GENRE_COLORS } from "../ArtistAvatar";
import AddRemoveBin from "./AddRemoveBin";
import { MatchedTrackChips } from "./MatchedTrackChips";
import { ReleaseChips } from "./ReleaseChips";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { toast } from "sonner";

export default function CatalogResult({ album }: { album: AlbumEntry }) {
  const { live } = useShowControl();
  const { addToQueue } = useQueue();
  const dispatch = useAppDispatch();

  const { selected, setSelection, sortBy } = useCatalogQuerySearch();

  const genreColor = GENRE_COLORS[(album.artist.genre as Genre) ?? "Unknown"] ?? "neutral";

  // Clamp instead of ellipsizing a single line; full text stays recoverable
  // via the title attribute.
  const lineClampSx = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
  } as const;

  return (
    <tr
      key={album.id}
      onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: album.id }))}
      style={{ cursor: "pointer" }}
    >
      <td
        style={{ textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected.includes(album.id)}
          color={selected.includes(album.id) ? "primary" : undefined}
          onChange={(event) => {
            setSelection(
              event.target.checked
                ? [...selected, album.id]
                : selected.filter((item) => item !== album.id)
            );
          }}
          slotProps={{ checkbox: { sx: { textAlign: "left" } } }}
          sx={{ verticalAlign: "text-bottom" }}
        />
      </td>
      <td>
        {album.artwork_url ? (
          <Box
            component="img"
            src={album.artwork_url}
            alt={`${album.artist.name} - ${album.title}`}
            sx={{
              width: 40,
              height: 40,
              borderRadius: "sm",
              objectFit: "cover",
            }}
          />
        ) : (
          <Avatar
            variant="soft"
            color={genreColor}
            sx={{
              width: 40,
              height: 40,
              borderRadius: "sm",
            }}
          >
            <AlbumIcon />
          </Avatar>
        )}
      </td>
      <td>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <div>
            <Typography
              fontWeight={sortBy === "artist" ? "bold" : "normal"}
              level="body-sm"
              textColor="text.primary"
              title={album.album_artist ? "Various Artists" : album.artist.name}
              sx={lineClampSx}
            >
              {album.album_artist ? "Various Artists" : album.artist.name}
            </Typography>
            <Typography
              level="body-sm"
              title={album.album_artist ?? album.alternate_artist}
              sx={lineClampSx}
            >
              {album.album_artist ?? album.alternate_artist}
            </Typography>
          </div>
        </Box>
      </td>
      <td>
        <Typography
          fontWeight={sortBy === "album" ? "bold" : "normal"}
          level="body-sm"
          textColor="text.primary"
          title={album.title}
          sx={lineClampSx}
        >
          {album.title}
        </Typography>
        <ReleaseChips
          genre={album.artist.genre}
          format={album.format}
          onStreaming={album.on_streaming}
        />
        <MatchedTrackChips matched_via={album.matched_via} />
      </td>
      <td>
        <Typography
          level="body-sm"
          sx={{ fontFamily: "code", whiteSpace: "nowrap" }}
        >
          {album.artist.lettercode} {album.artist.numbercode}/{album.entry}
        </Typography>
      </td>
      <td>
        <Typography level="body-sm">
          {album.plays != null && album.plays > 0 ? album.plays : "—"}
        </Typography>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <Stack direction="row" gap={0.25}>
          <Tooltip variant="outlined" size="sm" title="More information">
            <IconButton
              aria-label="More information"
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: album.id }))}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
          {live && (
            <Tooltip title="Add to Queue" variant="outlined" size="sm">
              <IconButton
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
            </Tooltip>
          )}
          <AddRemoveBin album={album} />
        </Stack>
      </td>
    </tr>
  );
}
