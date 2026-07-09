"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Stack, Tooltip } from "@mui/joy";

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
  const isSelected = selected.includes(album.id);

  const artistDisplay = album.album_artist ? "Various Artists" : album.artist.name;
  const artistDetail = album.album_artist ?? album.alternate_artist;

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
      className={isSelected ? "row-selected" : undefined}
      onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: album.id }))}
      style={{ cursor: "pointer" }}
    >
      <td
        style={{ textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          color={isSelected ? "primary" : undefined}
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
              width: 48,
              height: 48,
              borderRadius: "sm",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              width: 48,
              height: 48,
              borderRadius: "sm",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: (theme) =>
                `linear-gradient(135deg, ${theme.vars.palette[genreColor][400]}, ${theme.vars.palette[genreColor][700]})`,
            }}
          >
            <Typography
              level="title-sm"
              sx={{
                color: "#fff",
                opacity: 0.9,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              {album.artist.lettercode}
            </Typography>
          </Box>
        )}
      </td>
      <td>
        <Typography
          level="title-sm"
          fontWeight={sortBy === "album" ? "lg" : "md"}
          textColor="text.primary"
          title={album.title}
          sx={lineClampSx}
        >
          {album.title}
        </Typography>
        <MatchedTrackChips matched_via={album.matched_via} />
      </td>
      <td>
        <Typography
          level="body-sm"
          fontWeight={sortBy === "artist" ? "bold" : "md"}
          textColor="text.secondary"
          title={artistDisplay}
          sx={lineClampSx}
        >
          {artistDisplay}
        </Typography>
        {artistDetail && (
          <Typography
            level="body-xs"
            textColor="text.tertiary"
            title={artistDetail}
            sx={lineClampSx}
          >
            {artistDetail}
          </Typography>
        )}
      </td>
      <td>
        <ReleaseChips
          genre={album.artist.genre}
          format={album.format}
          rotation={album.rotation_bin}
          onStreaming={album.on_streaming}
        />
      </td>
      <td>
        <Typography
          level="body-sm"
          textColor="text.secondary"
          sx={{ fontFamily: "code", whiteSpace: "nowrap" }}
        >
          {album.artist.lettercode} {album.artist.numbercode}/{album.entry}
        </Typography>
      </td>
      <td>
        <Typography
          level="body-sm"
          textColor={
            album.plays != null && album.plays > 0
              ? "text.secondary"
              : "text.tertiary"
          }
        >
          {album.plays != null && album.plays > 0 ? album.plays : "—"}
        </Typography>
      </td>
      <td>
        <Typography
          level="body-sm"
          textColor="text.tertiary"
          title={album.label}
          sx={lineClampSx}
        >
          {album.label || "—"}
        </Typography>
      </td>
      {/* Zero-width sticky cell pinned to the scroll container's right edge,
          so the hover actions always sit at the visible edge regardless of
          horizontal scroll. */}
      <td className="actions-cell">
        <Stack
          direction="row"
          gap={0.25}
          className="row-actions"
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            borderRadius: "sm",
            pl: 3,
            pr: 0.5,
          }}
        >
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
