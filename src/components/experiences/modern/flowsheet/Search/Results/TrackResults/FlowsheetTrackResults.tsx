import type { TrackSearchResult } from "@wxyc/shared";
import { Box, Stack, Typography } from "@mui/joy";
import FlowsheetTrackResult from "./FlowsheetTrackResult";

export default function FlowsheetTrackResults({
  results,
  offset,
  label,
}: {
  results: TrackSearchResult[];
  offset: number;
  label: string;
}) {
  return (
    <>
      <Box
        sx={{
          visibility: results.length > 0 ? "inherit" : "hidden",
          p: results.length > 0 ? 1 : 0,
          height: results.length > 0 ? "auto" : 0,
        }}
      >
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {label.toUpperCase()}
        </Typography>
      </Box>
      <Stack
        direction="column"
        sx={{ visibility: results.length > 0 ? "inherit" : "hidden" }}
      >
        {results.map((entry, index) => (
          <FlowsheetTrackResult
            key={`${label.replace(" ", "-")}-${index}`}
            entry={entry}
            index={index + offset}
          />
        ))}
      </Stack>
    </>
  );
}
