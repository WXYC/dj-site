import { Box, Grid, Typography } from "@mui/joy"
import React from "react"
import PlaylistCard from "../../widgets/playlists/PlaylistCard"

const examplePlaylists = [
    {
        name: "Playlist 1",
        previewArtists: ["Royal Blood", "Muse", "Florence + The Machine", "King Crimson"],
        previewAlbums: ["How Did We Get So Dark?", "The 2nd Law", "Lungs", "In The Court of the Crimson King"],
        date: "2021-10-01"
    }
]

const PlaylistsPage = () => {
    return (
        <>
        <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 1,
          gap: 1,
          flexWrap: 'wrap',
          '& > *': {
            minWidth: 'clamp(0px, (500px - 100%) * 999, 100%)',
            flexGrow: 1,
          },
        }}
      >
        <Typography level="h1">
          Your Playlists
        </Typography>
        <Box sx = {{ flex: 999 }}></Box>
    </Box>
    <Grid container spacing={1}>
        {examplePlaylists.map((playlist) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={playlist.name}>
                <PlaylistCard playlist={playlist} />
            </Grid>
        ))}
    </Grid>
    </>
    )
}

export default PlaylistsPage