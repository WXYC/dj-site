import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPlaylistFromBackend } from "../../services/playlists/playlists-service";
import { toast } from "sonner";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";
import FlowsheetEntry from "../../components/flowsheet/FlowsheetEntry";
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';

/**
 * @page
 * @category Playlists
 * @description Renders a page displaying a playlist, which is a set of flowsheet entries, getting the playlist name and DJ name from the URL.
 * This is currently a placeholder page.
 * 
 * @returns {JSX.Element} The rendered list of flowsheet entries for a given set.
 */
const PlaylistPage = () => {

    const { djName, playlistId } = useParams();
    const [ playlist, setPlaylist ] = useState([]);

    const navigate = useNavigate();

    const updatePlaylistFromBackend = (data) => {

        let newPlaylist = data.map((item) => (
            (item?.message?.length) > 0 ? 
            {
                message: item.message,
                title: "",
                album: "",
                artist: "",
                label: "",
                entry_id: item.id
            } : {
                message: "",
                title: item.track_title,
                album: item.album_title,
                artist: item.artist_name,
                label: item.record_label,
                entry_id: item.id
            }));

        setPlaylist(newPlaylist);
    }

    useEffect(() => {
        (async () => {
            const { data, error } = await getPlaylistFromBackend(playlistId);

            if (error) {
                console.error(error);
                toast.error("We could not retrieve your playlist...");
            }

            console.table(data);
            updatePlaylistFromBackend(data);

        })();
    }, []);

    return (
        <div>
        <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          my: 1,
          gap: 1,
          flexWrap: "wrap",
          flexDirection: "column",
          "& > *": {
            minWidth: "clamp(0px, (500px - 100%) * 999, 100%)",
            flexGrow: 1,
          },
        }}
      >
        <Button
            variant="outlined"
            color="neutral"
            size="sm"
            onClick={() => navigate(`/playlists`)}
            startDecorator={<KeyboardBackspaceIcon />}
        >
            Back
        </Button>
        <Typography level="h2">Playlist 1</Typography>
        <Typography level="body1">Playlist 1</Typography>
        <Box sx={{ flex: 999 }}></Box>
    </Box>
        <Sheet
        sx={{
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto",
          background: "transparent",
          mt: 2,
          overflowX: 'visible',
        }}
      >
            <Stack direction="column" spacing={1}>
                {playlist.map((entry, index) => (
                    <FlowsheetEntry
                        editable={false}
                        index = {index}
                        key={`entry-${index}`}
                        type={
                            entry?.message?.length > 0
                              ? entry?.message?.includes("joined")
                                ? "joined"
                                : entry?.message?.includes("left")
                                ? "left"
                                : entry?.message?.includes("Breakpoint")
                                ? "breakpoint"
                                : entry?.message?.includes("Talkset")
                                ? "talkset"
                                : "error"
                              : "entry"
                          }
                        current={false}
                        {...entry}
                    />
                ))}
            </Stack>
        </Sheet>
        </div>
    )
}

export default PlaylistPage;