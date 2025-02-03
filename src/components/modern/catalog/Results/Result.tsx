"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Stack, Tooltip } from "@mui/joy";

import { useBin } from "@/src/hooks/binHooks";
import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import { Inventory, QueueMusic } from "@mui/icons-material";
import Link from "next/link";
import DeleteFromBin from "../../Rightbar/Bin/DeleteFromBin";
import { ArtistAvatar } from "../ArtistAvatar";
import AddToBin from "./AddToBin";

export default function CatalogResult({ album }: { album: AlbumEntry }) {
  const { selected, setSelection, orderBy } = useCatalogSearch();

  const { bin, loading: binLoading } = useBin();

  return (
    <tr key={album.id}>
      <td style={{ textAlign: "center" }}>
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
        <ArtistAvatar
          entry={album.entry}
          artist={album.artist}
          format={album.format}
          rotation={album.play_freq}
        />
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
        <Typography level="body-xs">{album.artist.genre}</Typography>
        <Typography level="body-md">
          {album.artist.lettercode} {album.artist.numbercode}/{album.entry}
        </Typography>
      </td>
      <td>
        <Chip
          variant="soft"
          size="sm"
          color={album.format.includes("Vinyl") ? "primary" : "warning"}
        >
          {album.format}
        </Chip>
      </td>
      <td>0</td>
      <td>
        <Stack direction="row" gap={0.25}>
          <Tooltip variant="outlined" size="sm" title="More information">
            <Link href={`/dashboard/album/${album.id}`}>
              <IconButton
                aria-label="More information"
                variant="soft"
                color="neutral"
                size="sm"
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Link>
          </Tooltip>
          <Tooltip title="Will add to queue">
            <IconButton onClick={() => {}}>
              <QueueMusic />
            </IconButton>
          </Tooltip>
          {binLoading || !bin ? (
            <IconButton loading disabled>
              <Inventory />
            </IconButton>
          ) : bin.find((item) => item.id === album.id) ? (
            <DeleteFromBin album={album} />
          ) : (
            <AddToBin album={album} />
          )}
        </Stack>
      </td>
    </tr>
  );
}
