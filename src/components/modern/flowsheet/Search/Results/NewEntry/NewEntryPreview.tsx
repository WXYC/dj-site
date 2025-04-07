import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheetSubmit } from "@/src/hooks/flowsheetHooks";
import { Box, Stack, Typography } from "@mui/joy";
import PreviewChip from "./PreviewChip";

export default function NewEntryPreview() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  const searchQueryLength = useAppSelector(
    flowsheetSlice.selectors.getSearchQueryLength
  );

  const { ctrlKeyPressed: submittingToQueue, handleSubmit } =
    useFlowsheetSubmit();

  return searchQueryLength > 0 ? (
    <Box
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
      <Typography
        level="body-md"
        sx={{ color: selected == 0 ? "neutral.200" : "inherit" }}
      >
        CREATE A NEW ENTRY WITH THE FOLLOWING FIELDS:
      </Typography>
      <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
        <PreviewChip label="Album" name="album" />
        <PreviewChip label="Artist" name="artist" />
        <PreviewChip label="Song" name="song" />
        <PreviewChip label="Label" name="label" />
      </Stack>
    </Box>
  ) : null;
}
