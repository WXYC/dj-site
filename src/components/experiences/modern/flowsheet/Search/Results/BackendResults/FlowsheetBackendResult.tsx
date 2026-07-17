import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useMetadataPrefetch } from "@/lib/features/metadata/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { WXYC_EXCLUSIVE_PURPLE } from "@/src/utilities/modern/brandColors";
import { formatTone } from "@/lib/features/experiences/modern/tokens/roles";
import { Chip, Stack, Typography } from "@mui/joy";

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

  // Warm the tracklist cache so the picker is instantaneous once the result is
  // highlighted (LML's 3-tier cache + BS's 10-minute LRU absorb the actual
  // request). Same pattern as rotation prefetch, but per-row instead of
  // per-bin since search results are heterogeneous.
  const prefetchTracks = useMetadataPrefetch("getLibraryTracks");

  return (
    <Stack
      key={`bin-${index}`}
      direction="row"
      justifyContent="space-between"
      data-testid={`flowsheet-search-result-${index}`}
      sx={{
        p: 1,
        backgroundColor: selected == index ? "primary.700" : "transparent",
        cursor: "pointer",
      }}
      onMouseOver={() => {
        setSelected(index);
        if (entry.id) prefetchTracks(entry.id);
      }}
      // Autofill, never submit; prevented mousedown keeps input focus
      onMouseDown={(e) => {
        e.preventDefault();
        dispatch(
          flowsheetSlice.actions.freezeSelectionToQuery({
            artist: entry.artist?.name ?? "",
            album: entry.title ?? "",
            label: entry.label ?? "",
            album_id: entry.id ?? undefined,
            rotation_id: entry.rotation_id ?? undefined,
            rotation_bin: entry.rotation_bin ?? undefined,
          })
        );
      }}
    >
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
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
            fontFamily: "monospace",
            fontSize: "1rem",
          }}
        >
          {entry.artist?.genre} {entry.artist?.lettercode}{" "}
          {entry.artist?.numbercode}/{entry.entry}
          <Chip
            variant="soft"
            size="sm"
            color={formatTone(entry.format).color}
            sx={{
              ml: 2,
            }}
          >
            {entry.format.includes("vinyl") ? "vinyl" : "cd"}
          </Chip>
          {entry.on_streaming === false && (
            <Chip
              variant="soft"
              size="sm"
              sx={{
                ml: 1,
                backgroundColor: WXYC_EXCLUSIVE_PURPLE,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "0.6rem",
              }}
            >
              EXCLUSIVE
            </Chip>
          )}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
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
            fontStyle: entry.artist?.name ? "normal" : "italic",
            opacity: entry.artist?.name ? 1 : 0.6,
          }}
        >
          {entry.artist?.name || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
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
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
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
