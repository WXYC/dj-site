"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useAdminCatalogSearch } from "@/src/hooks/catalogHooks";
import { Album as AlbumIcon } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Settings } from "@mui/icons-material";
import { Avatar, Box, Checkbox, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import { GENRE_COLORS, GENRE_VARIANTS } from "../../catalog/ArtistAvatar";

/**
 * Admin catalog search row: roster-style Settings opens album detail in Rightbar;
 * no queue / bin actions (catalog admin context).
 */
export default function AdminCatalogResult({ album }: { album: AlbumEntry }) {
  const dispatch = useAppDispatch();
  const { selected, setSelection, orderBy } = useAdminCatalogSearch();

  const genreColor =
    GENRE_COLORS[(album.artist.genre as Genre) ?? "Unknown"] ?? "neutral";
  const genreVariant =
    GENRE_VARIANTS[(album.artist.genre as Genre) ?? "Unknown"] ?? "soft";

  const openDetail = () =>
    dispatch(
      applicationSlice.actions.openPanel({
        type: "album-detail",
        albumId: album.id,
      })
    );

  return (
    <tr
      key={album.id}
      onClick={openDetail}
      style={{ cursor: "pointer" }}
    >
      <td
        style={{ textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected.includes(album.id)}
          color={selected.includes(album.id) ? "success" : undefined}
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
              fontWeight={orderBy == "Artist" ? "bold" : "normal"}
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
          fontWeight={orderBy == "Album" ? "bold" : "normal"}
          level="body-sm"
          textColor="text.primary"
        >
          {album.title}
        </Typography>
      </td>
      <td>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="nowrap">
          <Chip variant={genreVariant} color={genreColor} size="sm">
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
                backgroundColor: "#7B2D8E",
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
        <Stack direction="row" gap={0.25} alignItems="center">
          <Tooltip variant="outlined" size="sm" title="Album in Rightbar">
            <IconButton
              aria-label="Open album in sidebar"
              variant="plain"
              color="neutral"
              size="sm"
              onClick={openDetail}
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip variant="outlined" size="sm" title="Settings">
            <IconButton
              aria-label="Open album settings in sidebar"
              variant="solid"
              color="success"
              size="sm"
              onClick={openDetail}
            >
              <Settings />
            </IconButton>
          </Tooltip>
        </Stack>
      </td>
    </tr>
  );
}
