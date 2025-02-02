"use client";

import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import { ChangeEvent, useEffect, useRef } from "react";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { Stack, Table, Tooltip } from "@mui/joy";

import { useCatalogResults } from "@/src/hooks/catalogHooks";
import { Inventory, QueueMusic } from "@mui/icons-material";
import { ColorPaletteProp } from "@mui/joy";
import { ArtistAvatar } from "../ArtistAvatar";
import ResultsContainer from "./ResultsContainer";
import TableHeader from "./TableHeader";
import Link from "next/link";

export default function Results({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const {
    data: releaseList,
    loading,
    selected,
    setSelection,
    loadMore,
    reachedEndForQuery,
    orderBy,
  } = useCatalogResults();
  return (
    <ResultsContainer>
      <Table
        aria-labelledby="tableTitle"
        stickyHeader
        hoverRow
        sx={{
          "--TableCell-headBackground": (theme) =>
            theme.vars.palette.background.level1,
          "--Table-headerUnderlineThickness": "1px",
          "--TableRow-hoverBackground": (theme) =>
            theme.vars.palette.background.level1,
          "& tr > *:last-child": {
            position: "sticky",
            right: 0,
            bgcolor: "var(--TableCell-headBackground)",
          },
        }}
      >
        <thead>
          <tr>
            <th style={{ width: 48, textAlign: "center", padding: 12 }}>
              <Checkbox
                indeterminate={
                  selected.length > 0 && selected.length !== releaseList?.length
                }
                checked={selected.length === releaseList?.length}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setSelection(
                    event.target.checked
                      ? releaseList?.map((row) => row.id) ?? []
                      : []
                  );
                }}
                color={
                  selected.length > 0 || selected.length === releaseList?.length
                    ? "primary"
                    : undefined
                }
                sx={{ verticalAlign: "text-bottom" }}
              />
            </th>
            <th style={{ width: 50, padding: 12 }}></th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader textValue="Artist" />
            </th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader textValue="Title" />
            </th>
            <th style={{ width: 60, padding: 12 }}>
              <TableHeader textValue="Code" />
            </th>
            <th style={{ width: 70, padding: 12 }}>
              <TableHeader textValue="Format" />
            </th>
            <th style={{ width: 60, padding: 12 }}>
              <TableHeader textValue="Plays" />
            </th>
            <th style={{ width: 120, padding: 12 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={8}
                style={{
                  textAlign: "center",
                  paddingTop: "3rem",
                  background: "transparent",
                }}
              >
                <CircularProgress color="primary" size="md" />
              </td>
            </tr>
          ) : (
            releaseList?.map((album) => (
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
                      <Typography level="body-sm">
                        {album.alternate_artist}
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
                  <Typography level="body-xs">
                    {album.artist.genre}
                  </Typography>
                  <Typography level="body-md">
                    {album.artist.lettercode} {album.artist.numbercode}/
                    {album.entry}
                  </Typography>
                </td>
                <td>
                  <Chip
                    variant="soft"
                    size="sm"
                    color={
                      album.format.includes("Vinyl") ? "primary" : "warning"
                    }
                  >
                    {album.format}
                  </Chip>
                </td>
                <td>0</td>
                <td>
                  <Stack direction="row" gap={0.25}>
                    <Tooltip
                      variant="outlined"
                      size="sm"
                      title="More information"
                    >
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
                    <Tooltip title="Will add to bin">
                      <IconButton onClick={() => {}}>
                        <Inventory />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </td>
              </tr>
            ))
          )}

          {!loading && !reachedEndForQuery && (
            <tr>
              <td colSpan={8} style={{ textAlign: "center" }}>
                <Button
                  variant="solid"
                  color="primary"
                  size="lg"
                  sx={{
                    marginRight: "1rem",
                  }}
                  onClick={loadMore}
                >
                  Load more
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </ResultsContainer>
  );
}
