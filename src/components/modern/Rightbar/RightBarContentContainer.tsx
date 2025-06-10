import { Inbox } from "@mui/icons-material";
import { Box, List, ListSubheader, Stack, Typography } from "@mui/joy";

export default function RightBarContentContainer({
  decorator,
  label,
  children,
}: {
  decorator: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2,
        pb: 3,
      }}
    >
      <List
        sx={{
          flexGrow: 1,
        }}
      >
        <ListSubheader
          role="presentation"
          sx={{
            color: "text.primary",
            mb: 1,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row">
            {decorator}
            <Typography>{label}</Typography>
          </Stack>
        </ListSubheader>
        {children}
      </List>
    </Box>
  );
}
