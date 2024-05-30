'use client';

import { Box, Divider, Typography } from "@mui/joy";

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
        <Typography level="h1">Your Playlists</Typography>
        <Box sx={{ flex: 999 }}></Box>
        <Divider />
      </Box>
    );
};

export default PlaylistsPage;