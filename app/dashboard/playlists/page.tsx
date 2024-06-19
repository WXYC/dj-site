'use client';

import PlaylistCard from "@/app/components/Playlists/PlaylistCard";
import { Box, Divider, Stack, Typography } from "@mui/joy";

const PlaylistsPage = () => {
    return (
    <Box
        sx={{
          display: "flex",
          alignItems: "center",
          my: 1,
          gap: 1,
          flexWrap: "wrap",
          "& > *": {
            minWidth: "clamp(0px, (500px - 100%) * 999, 100%)",
            flexGrow: 1,
          },
        }}
    >
      <Stack direction="column" spacing={1}>
        <Typography level="h1">Your Playlists</Typography>
        <Divider />
        <PlaylistCard />
      </Stack>
      </Box>
    );
};

export default PlaylistsPage;