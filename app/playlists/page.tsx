import WXYCPage from "@/src/Layout/WXYCPage";
import { PlaylistSearchContainer } from "@/src/components/experiences/modern/playlist-search";
import { Box } from "@mui/joy";

export default function PlaylistsPage() {
  return (
    <WXYCPage title="Playlist Archive">
      <Box
        sx={{
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          py: 2,
        }}
      >
        <PlaylistSearchContainer />
      </Box>
    </WXYCPage>
  );
}
