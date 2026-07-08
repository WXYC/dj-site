import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useMetadataPrefetch } from "@/lib/features/metadata/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Chip, ColorPaletteProp, Stack, Typography } from "@mui/joy";
import { useCallback } from "react";

export default function FlowsheetBackendResult({
  entry,
  index,
  onStage,
}: {
  entry: AlbumEntry;
  index: number;
  onStage?: (entry: AlbumEntry) => void;
}) {
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);

  const dispatch = useAppDispatch();
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  const prefetchTracks = useMetadataPrefetch("getLibraryTracks");

  const scrollRef = useCallback((el: HTMLElement | null) => {
    if (selected === index && el?.scrollIntoView) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selected, index]);

  return (
    <Stack
      ref={scrollRef}
      key={`bin-${index}`}
      direction="row"
      justifyContent="space-between"
      role="option"
      id={`flowsheet-option-${index}`}
      aria-selected={selected === index}
      data-testid={`flowsheet-search-result-${index}`}
      sx={{
        p: 1,
        backgroundColor:
          selected === index ? "primary.softBg" : "transparent",
        cursor: "pointer",
        "&:hover": { bgcolor: "background.level1" },
      }}
      onMouseEnter={() => {
        setSelected(index);
        if (entry.id) prefetchTracks(entry.id);
      }}
      onClick={() => onStage?.(entry)}
    >
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected === index ? "primary.300" : "text.tertiary",
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
            fontFamily: "monospace",
            fontSize: "1rem",
          }}
        >
          {entry.artist?.genre} {entry.artist?.lettercode}{" "}
          {entry.artist?.numbercode}/{entry.entry}
          <Chip
            variant="soft"
            size="sm"
            color={
              (entry.format.includes("vinyl")
                ? "primary"
                : "info") as ColorPaletteProp
            }
            sx={{ ml: 2 }}
          >
            {entry.format.includes("vinyl") ? "vinyl" : "cd"}
          </Chip>
          {entry.on_streaming === false && (
            <Chip
              variant="soft"
              size="sm"
              sx={{
                ml: 1,
                backgroundColor: "#7B2D8E",
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
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          ARTIST
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontStyle: entry.artist?.name ? "normal" : "italic",
            opacity: entry.artist?.name ? 1 : 0.6,
          }}
        >
          {entry.artist?.name || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          ALBUM
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontStyle: entry.title ? "normal" : "italic",
            opacity: entry.title ? 1 : 0.6,
          }}
        >
          {entry.title || "Unknown"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ flex: 1, minWidth: 0, px: 1 }}>
        <Typography level="body-xs" sx={{ mb: -0.5, color: "text.tertiary" }}>
          LABEL
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
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
