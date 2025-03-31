import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { ArtistAvatar } from "@/src/components/modern/catalog/ArtistAvatar";
import { Chip, ColorPaletteProp, Stack, Typography } from "@mui/joy";
import { useState } from "react";

export default function FlowsheetBackendResult({
  entry,
  index,
}: {
  entry: AlbumEntry;
  index: number;
}) {
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);

  const dispatch = useAppDispatch();
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  return (
    <Stack
      key={`bin-${index}`}
      direction="row"
      justifyContent="space-between"
      sx={{
        p: 1,
        backgroundColor: selected == index ? "primary.700" : "transparent",
        cursor: "pointer",
      }}
      onMouseOver={() => setSelected(index)}
      onClick={() => `Will submit ${selected}`}
    >
      <ArtistAvatar
        artist={entry.artist}
        format={entry.format}
        entry={entry.entry}
        rotation={entry.play_freq}
      />
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-md"
          sx={{
            mb: -1,
            color: selected == index ? "neutral.200" : "inherit",
          }}
        >
          CODE
        </Typography>
        <Typography
          component={"div"}
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "white" : "inherit",
          }}
        >
          {entry.artist.genre} {entry.artist.lettercode}{" "}
          {entry.artist.numbercode}/{entry.entry}
          <Chip
            variant="soft"
            size="sm"
            color={
              (entry.format.includes("vinyl")
                ? "primary"
                : "info") as ColorPaletteProp
            }
            sx={{
              ml: 2,
            }}
          >
            {entry.format.includes("vinyl") ? "vinyl" : "cd"}
          </Chip>
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-md"
          sx={{
            mb: -1,
            color: selected == index ? "neutral.200" : "inherit",
          }}
        >
          ARTIST
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "white" : "inherit",
          }}
        >
          {entry.artist.name}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-md"
          sx={{
            mb: -1,
            color: selected == index ? "neutral.200" : "inherit",
          }}
        >
          ALBUM
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "white" : "inherit",
          }}
        >
          {entry.title}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-md"
          sx={{
            mb: -1,
            color: selected == index ? "neutral.200" : "inherit",
          }}
        >
          LABEL
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "white" : "inherit",
          }}
        >
          {entry.label}
        </Typography>
      </Stack>
    </Stack>
  );
}
