import type { TrackSearchResult } from "@wxyc/shared";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheetSubmit } from "@/src/hooks/flowsheetHooks";
import { Chip, ColorPaletteProp, Stack, Typography } from "@mui/joy";
import { MusicNote } from "@mui/icons-material";

export default function FlowsheetTrackResult({
  entry,
  index,
}: {
  entry: TrackSearchResult;
  index: number;
}) {
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);

  const dispatch = useAppDispatch();
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  const { ctrlKeyPressed: submittingToQueue, handleSubmit } =
    useFlowsheetSubmit();

  const rotationColor = (freq: string | undefined): ColorPaletteProp => {
    switch (freq) {
      case "H":
        return "danger";
      case "M":
        return "warning";
      case "L":
        return "success";
      case "S":
        return "primary";
      default:
        return "neutral";
    }
  };

  return (
    <Stack
      key={`track-${index}`}
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
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ width: "40px", flexShrink: 0 }}
      >
        <MusicNote
          sx={{
            color: selected == index ? "white" : "text.tertiary",
            fontSize: "1.2rem",
          }}
        />
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
          }}
        >
          SONG
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "white" : "inherit",
            fontWeight: 500,
          }}
        >
          {entry.title}
          {entry.play_freq && (
            <Chip
              variant="soft"
              size="sm"
              color={rotationColor(entry.play_freq)}
              sx={{ ml: 1 }}
            >
              {entry.play_freq}
            </Chip>
          )}
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
            fontStyle: entry.artist_name ? "normal" : "italic",
            opacity: entry.artist_name ? 1 : 0.6,
          }}
        >
          {entry.artist_name || "Unknown"}
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
            fontStyle: entry.album_title ? "normal" : "italic",
            opacity: entry.album_title ? 1 : 0.6,
          }}
        >
          {entry.album_title || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(15%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == index ? "neutral.300" : "text.tertiary",
          }}
        >
          SOURCE
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == index ? "neutral.300" : "text.tertiary",
            textTransform: "capitalize",
          }}
        >
          {entry.source}
        </Typography>
      </Stack>
    </Stack>
  );
}
