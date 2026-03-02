import WXYCPage from "@/src/Layout/WXYCPage";
import { PlaylistSearchContainer } from "@/src/components/experiences/modern/playlist-search";
import { Box } from "@mui/joy";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Playlist Archive"),
};

export default function PlaylistsPage() {
  return (
    <WXYCPage>
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
