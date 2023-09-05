import { Box, CircularProgress, Grid, Option, Select, Sheet, Stack, Typography } from "@mui/joy"
import React, { useEffect, useState } from "react"
import PlaylistCard from "../../components/playlists/PlaylistCard"
import { getPlaylistsFromBackend } from "../../services/playlists/playlists-service";
import { toast } from "sonner";

/**
 * The page that displays all playlists for a given user. Contains sorting and filtering options.
 * 
 * @page
 * @category Playlists
 * 
 * @returns {JSX.Element} The fully rendered PlaylistsPage component.
 */
const PlaylistsPage = () => {

    const [sort, setSort] = useState("date");
    const [ascdesc, setAscdesc] = useState(false); // false = descending, true = ascending
    const [playlists, setPlaylists] = useState([]);

    useEffect(() => {
        (async () => {
          const { data, error } = await getPlaylistsFromBackend();

          if (error) {
            toast.error("We could not retrieve your playlists...");
            console.error(error);
          }

          let dj_set = data.map((item, idx) => ({
            id: item.show,
            name: item.show_name.length > 0 ? item.show_name : `Playlist ${idx + 1}`,
            date: item.date,
            previewArtists: item.preview.map((item) => item.artist_name),
            previewAlbums: item.preview.map((item) => item.album_title),
            djs: item.djs,
          }));
          
          setPlaylists(dj_set);
        })();
    }, []);

    const sortPlaylists = (playlistSet, by, asc) => {
      if (playlistSet === undefined || playlistSet?.length === 0 || playlistSet === null) return null;
      if (by === "name") {
        return playlistSet.sort((a, b) => {
          if (asc) {
            return a.name.localeCompare(b.name);
          } else {
            return b.name.localeCompare(a.name);
          }
        });
      } else if (by === "date") {
        return playlistSet.sort((a, b) => {
          if (asc) {
            return a.date.localeCompare(b.date);
          } else {
            return b.date.localeCompare(a.date);
          }
        });
      } else if (by === "random") {
        return playlistSet.sort(() => Math.random() - 0.5);
      } else if (by === "dj") {
        return playlistSet; // TODO: implement
      } else {
        return playlistSet;
      }
    };

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
    <Box>
      <Typography level="body3">
        Sort by
      </Typography>
      <Stack direction="row" spacing={1}>
      <Select
        sx = {{
          maxWidth: {
            xs: '100%',
            sm: '300px',
          }
        }}
        size="sm"
        defaultValue={"date"}
        onChange={(e, newValue) => setSort(newValue)}
      >
        <Option value="date">Date</Option>
        <Option value="name">Name</Option>
        <Option value="random">Random</Option>
      </Select>
      <Select
        sx = {{
          maxWidth: {
            xs: '100%',
            sm: '200px',
          }
        }}
        size="sm"
        defaultValue={"desc"}
        onChange={(e, newValue) => setAscdesc(newValue === "asc")}
      >
        <Option value="asc">Ascending</Option>
        <Option value="desc">Descending</Option>
      </Select>
      </Stack>
    </Box>
    <Sheet
    variant="outlined"
      sx={{
        borderRadius: 'lg',
        p: 1,
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'scroll'
      }}
    >
    <Grid container spacing={0}>
        {sortPlaylists(playlists, sort, ascdesc)?.map((playlist) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={3} key={playlist.name}
            >
              <Box
                sx = {{
                  padding: 1, // absolutely vital to the layout
                  margin: 0.5,
                }}
              >
                <PlaylistCard playlist={playlist} />
              </Box>
            </Grid>
        )) ?? <CircularProgress />}
    </Grid>
    </Sheet>
    </>
    )
}

export default PlaylistsPage