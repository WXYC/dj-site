import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheetSubmit } from "@/src/hooks/flowsheetHooks";
import { Box, Stack, Typography } from "@mui/joy";
import CreateIcon from "@mui/icons-material/Create";

export default function NewEntryPreview() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  const searchQueryLength = useAppSelector(
    flowsheetSlice.selectors.getSearchQueryLength
  );

  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  const { ctrlKeyPressed: submittingToQueue, handleSubmit } =
    useFlowsheetSubmit();

  return searchQueryLength > 0 ? (
    <Stack
      direction="row"
      justifyContent="space-between"
      sx={{
        p: 1,
        backgroundColor:
          selected == 0
            ? submittingToQueue
              ? "success.700"
              : "primary.700"
            : "transparent",
        cursor: "pointer",
        visibility: searchQueryLength > 0 ? "visible" : "hidden",
      }}
      onMouseOver={() => setSelected(0)}
      onClick={handleSubmit}
    >
      {/* Icon to indicate new entry */}
      <Box
        sx={{
          width: "3.2rem",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CreateIcon
          sx={{
            fontSize: "2.5rem",
            color: selected == 0 ? "neutral.200" : "text.secondary",
          }}
        />
      </Box>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == 0 ? "neutral.300" : "text.tertiary",
          }}
        >
          SONG
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == 0 ? "white" : "inherit",
            fontStyle: searchQuery.song ? "normal" : "italic",
            opacity: searchQuery.song ? 1 : 0.6,
          }}
        >
          {searchQuery.song || "Not specified"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == 0 ? "neutral.300" : "text.tertiary",
          }}
        >
          ARTIST
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == 0 ? "white" : "inherit",
            fontStyle: searchQuery.artist ? "normal" : "italic",
            opacity: searchQuery.artist ? 1 : 0.6,
          }}
        >
          {searchQuery.artist || "Not specified"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == 0 ? "neutral.300" : "text.tertiary",
          }}
        >
          ALBUM
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == 0 ? "white" : "inherit",
            fontStyle: searchQuery.album ? "normal" : "italic",
            opacity: searchQuery.album ? 1 : 0.6,
          }}
        >
          {searchQuery.album || "Not specified"}
        </Typography>
      </Stack>
      <Stack direction="column" sx={{ width: "calc(20%)" }}>
        <Typography
          level="body-xs"
          sx={{
            mb: -0.5,
            color: selected == 0 ? "neutral.300" : "text.tertiary",
          }}
        >
          LABEL
        </Typography>
        <Typography
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: selected == 0 ? "white" : "inherit",
            fontStyle: searchQuery.label ? "normal" : "italic",
            opacity: searchQuery.label ? 1 : 0.6,
          }}
        >
          {searchQuery.label || "Not specified"}
        </Typography>
      </Stack>
    </Stack>
  ) : null;
}
