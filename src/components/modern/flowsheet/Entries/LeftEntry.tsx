import { FlowsheetEndShowEntry } from "@/lib/features/flowsheet/types";
import { Headphones, Logout } from "@mui/icons-material";
import { Box, Sheet, Stack, Typography } from "@mui/joy";

export default function LeftEntry({ entry }: { entry: FlowsheetEndShowEntry }) {
  return (
    <Sheet
      color="primary"
      variant="outlined"
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
          <Logout sx={{ mb: -0.5, mr: 0.5 }} />
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Typography level="body-lg">End of Show</Typography>
        </Stack>
        <Box>
          <Typography level="body-xs">{entry.date_string}</Typography>
        </Box>
      </Stack>
    </Sheet>
  );
}
