import { Inbox } from "@mui/icons-material";
import { Box, Card, List, ListSubheader, Stack, Typography } from "@mui/joy";

export default function BinContent() {
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
            <Inbox sx={{ mr: 1 }} />
            <Typography>Mail Bin</Typography>
          </Stack>
        </ListSubheader>
        <Card
          variant="outlined"
          sx={{
            overflowY: "scroll",
            width: { xs: "100%", sm: 300, lg: 400 },
            height: 350,
          }}
        >
          <div>
            <Typography level="body-md">An empty record...</Typography>
          </div>
        </Card>
      </List>
    </Box>
  );
}
