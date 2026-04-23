"use client";

import { AlbumEntry, Genre } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";

import { Album as AlbumIcon } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Avatar, Stack, Tooltip } from "@mui/joy";

import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import { QueueMusic } from "@mui/icons-material";
import { useQueue, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useRouter } from "next/navigation";
import { GENRE_COLORS, GENRE_VARIANTS } from "../ArtistAvatar";
import AddRemoveBin from "./AddRemoveBin";
import { convertBinToQueue } from "@/lib/features/bin/conversions";
import { toast } from "sonner";

export default function CatalogResult({ album }: { album: AlbumEntry }) {
  const { live } = useShowControl();
  const { addToQueue } = useQueue();
  const router = useRouter();

  const { selected, setSelection, orderBy } = useCatalogSearch();

  const genreColor = GENRE_COLORS[(album.artist.genre as Genre) ?? "Unknown"] ?? "neutral";
  const genreVariant = GENRE_VARIANTS[(album.artist.genre as Genre) ?? "Unknown"] ?? "soft";

  return (
    <tr
      key={album.id}
      onClick={() => router.push(`/dashboard/album/${album.id}`)}
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
      </td>
      <td>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <div>
            <Typography
              fontWeight={orderBy == "Artist" ? "bold" : "normal"}
              level="body-sm"
              textColor="text.primary"
            >
              {album.artist.name}
            </Typography>
            <Typography level="body-sm">{album.alternate_artist}</Typography>
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
          <Chip
            variant={genreVariant}
            color={genreColor}
            size="sm"
          >
            {album.artist.genre}
          </Chip>
          <Typography level="body-sm" noWrap>
            {album.artist.lettercode} {album.artist.numbercode}/{album.entry}
          </Typography>
        </Stack>
      </td>
      <td>
        <Stack gap={0.5}>
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
              onClick={() => router.push(`/dashboard/album/${album.id}`)}
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
