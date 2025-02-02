import { FlowsheetStartShowEntry } from "@/lib/features/flowsheet/types";
import { Headphones } from "@mui/icons-material";
import { Box, Sheet, Stack, Typography } from "@mui/joy";

export default function JoinedEntry({
  entry,
}: {
  entry: FlowsheetStartShowEntry;
}) {
  return (
    <Sheet
      color="success"
      variant="solid"
      sx={{
        height: "40px",
        borderRadius: "md",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          height: "100%",
          p: 1,
        }}
      >
        <Typography textColor="text.tertiary">
          <Headphones sx={{ mb: -0.5, mr: 0.5 }} />
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">{entry.dj_name}</Typography>
          <Typography textColor={"text.tertiary"}>joined the set</Typography>
        </Stack>
        <Box>
          <Typography level="body-xs">{entry.date_string}</Typography>
        </Box>
      </Stack>
    </Sheet>
  );
}
