import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Stack, Typography } from "@mui/joy";
import FlowsheetBackendResult from "./FlowsheetBackendResult";

export default function FlowsheetBackendResults({
  results,
  offset,
  label,
}: {
  results: AlbumEntry[];
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
          <FlowsheetBackendResult
            key={`${label.replace(" ", "-")}-${index}`}
            entry={entry}
            index={index + offset}
          />
        ))}
      </Stack>
    </>
  );
}
