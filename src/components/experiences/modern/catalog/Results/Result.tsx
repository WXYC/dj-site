"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";

import { Album as AlbumIcon } from "@mui/icons-material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Avatar, Badge, Stack, Tooltip } from "@mui/joy";

import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { QueueMusic } from "@mui/icons-material";
import { useQueue, useShowControl } from "@/src/hooks/flowsheetHooks";
import { GENRE_COLORS, GENRE_VARIANTS, ROTATION_STYLES } from "../ArtistAvatar";
import { EXCLUSIVES_PURPLE } from "../Search/catalogFilterStyles";
import AddRemoveBin from "./AddRemoveBin";
import CatalogResultContextMenu, {
  useCatalogResultContextMenu,
} from "./CatalogResultContextMenu";
import { MatchedTrackChips } from "./MatchedTrackChips";
import { useCatalogResultActions } from "./useCatalogResultActions";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { toast } from "sonner";

export default function CatalogResult({ album }: { album: AlbumEntry }) {
  const { live } = useShowControl();
  const { addToQueue } = useQueue();
  const actions = useCatalogResultActions(album);
  const { openDetail, openEdit, canEditCatalog, displayRotationBin } = actions;
  const contextMenu = useCatalogResultContextMenu();

  const { selected, setSelection, sortBy } = useCatalogQuerySearch();

  const genreColor = GENRE_COLORS[(album.artist.genre as Genre) ?? "Unknown"] ?? "neutral";
  const genreVariant = GENRE_VARIANTS[(album.artist.genre as Genre) ?? "Unknown"] ?? "soft";

  const albumArt = album.artwork_url ? (
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
  );

  return (
    <>
      <tr
        key={album.id}
        onClick={openDetail}
        onContextMenu={contextMenu.onContextMenu}
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
          {displayRotationBin ? (
            <Tooltip
              variant="outlined"
              size="sm"
              title={`${displayRotationBin} rotation`}
            >
              <Badge
                badgeContent={displayRotationBin}
                color={ROTATION_STYLES[displayRotationBin] ?? "neutral"}
                size="sm"
              >
                {albumArt}
              </Badge>
            </Tooltip>
          ) : (
            albumArt
          )}
        </td>
        <td>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <div>
              <Typography
                fontWeight={sortBy === "artist" ? "bold" : "normal"}
                level="body-sm"
                textColor="text.primary"
              >
                {album.album_artist ? "Various Artists" : album.artist.name}
              </Typography>
              <Typography level="body-sm">
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
          >
            {album.title}
          </Typography>
          <MatchedTrackChips matched_via={album.matched_via} />
        </td>
        <td>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="nowrap">
            <Chip
              variant={genreVariant}
              color={genreColor}
              size="sm"
            >
              {album.artist.genre}
            </Chip>
            <Chip
              variant="soft"
              size="sm"
              color={album.format.includes("Vinyl") ? "primary" : "warning"}
            >
              {album.format}
            </Chip>
            {album.on_streaming === false && (
              <Chip
                variant="soft"
                size="sm"
                sx={{
                  bgcolor: EXCLUSIVES_PURPLE,
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "0.65rem",
                  letterSpacing: "0.5px",
                }}
              >
                WXYC EXCLUSIVE
              </Chip>
            )}
            <Typography level="body-sm" noWrap>
              {album.artist.lettercode} {album.artist.numbercode}/{album.entry}
            </Typography>
          </Stack>
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
                onClick={openDetail}
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
            {canEditCatalog && (
              <Tooltip variant="outlined" size="sm" title="Edit catalog entry">
                <IconButton
                  aria-label="Edit catalog entry in sidebar"
                  variant="plain"
                  color="success"
                  size="sm"
                  onClick={openEdit}
                >
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </td>
      </tr>
      <CatalogResultContextMenu
        actions={actions}
        open={contextMenu.open}
        anchorPosition={contextMenu.anchorPosition}
        onClose={contextMenu.onClose}
      />
    </>
  );
}
