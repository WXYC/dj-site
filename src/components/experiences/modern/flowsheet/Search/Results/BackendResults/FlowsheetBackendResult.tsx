import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { ArtistAvatar } from "@/src/components/experiences/modern/catalog/ArtistAvatar";
import { useFlowsheetSubmit } from "@/src/hooks/flowsheetHooks";
import { Chip, ColorPaletteProp, Stack, Typography } from "@mui/joy";

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

  const { ctrlKeyPressed: submittingToQueue, handleSubmit } =
    useFlowsheetSubmit();

  return (
    <Stack
      key={`bin-${index}`}
      direction="row"
      justifyContent="space-between"
      sx={{
        p: 1,
        backgroundColor:
          selected == index
            ? submittingToQueue
              ? "success.700"
              : "primary.700"
            : "transparent",
        cursor: "pointer",
      }}
      onMouseOver={() => setSelected(index)}
      onClick={handleSubmit}
    >
      <ArtistAvatar
        artist={entry.artist}
        format={entry.format}
        entry={entry.entry}
        rotation={entry.rotation_bin}
      />
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
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
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
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
            fontStyle: entry.artist.name ? "normal" : "italic",
            opacity: entry.artist.name ? 1 : 0.6,
          }}
        >
          {entry.artist.name || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
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
            fontStyle: entry.title ? "normal" : "italic",
            opacity: entry.title ? 1 : 0.6,
          }}
        >
          {entry.title || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
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
            fontStyle: entry.label ? "normal" : "italic",
            opacity: entry.label ? 1 : 0.6,
          }}
        >
          {entry.label || "Unknown"}
        </Typography>
      </Stack>
    </Stack>
  );
}
