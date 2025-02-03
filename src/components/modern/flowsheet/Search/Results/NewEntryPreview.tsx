import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Box, Stack, Typography } from "@mui/joy";
import PreviewChip from "./PreviewChip";

export default function NewEntryPreview({
  submitResult,
}: {
  submitResult: () => void;
}) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(flowsheetSlice.selectors.getSelectedResult);
  const setSelected = (index: number) =>
    dispatch(flowsheetSlice.actions.setSelectedResult(index));

  const searchQueryLength = useAppSelector(
    flowsheetSlice.selectors.getSearchQueryLength
  );

  return searchQueryLength > 0 ? (
    <Box
      sx={{
        p: 1,
        backgroundColor: selected == 0 ? "primary.700" : "transparent",
        cursor: "pointer",
      }}
      onMouseOver={() => setSelected(0)}
      onClick={submitResult}
    >
      <Typography
        level="body-md"
        sx={{ color: selected == 0 ? "neutral.200" : "inherit" }}
      >
        CREATE A NEW ENTRY WITH THE FOLLOWING FIELDS:
      </Typography>
      <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
        <PreviewChip label="Song" name="song" />
        <PreviewChip label="Artist" name="artist" />
        <PreviewChip label="Album" name="album" />
        <PreviewChip label="Label" name="label" />
      </Stack>
    </Box>
  ) : null;
}
