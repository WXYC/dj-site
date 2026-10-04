import WXYCPage from "@/src/Layout/WXYCPage";
import SSESubscription from "@/src/components/shared/SSESubscription";
import NowPlaying from "@/src/widgets/NowPlaying";
import {
  fetchNowPlayingSeed,
  fetchWhoIsLiveSeed,
} from "@/lib/features/flowsheet/server";
import { Box, Card } from "@mui/joy";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Listen Live"),
};

export default async function LivePage() {
  const [initialEntry, initialOnAirData] = await Promise.all([
    fetchNowPlayingSeed(),
    fetchWhoIsLiveSeed(),
  ]);

  return (
    <WXYCPage>
      <SSESubscription surface="live" />
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "90%",
          transform: "translate(-50%, -50%)",
          width: "clamp(300px, 100%, 600px)",
          backdropFilter: "blur(8px)",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <NowPlaying
          mini={false}
          initialEntry={initialEntry}
          initialOnAirData={initialOnAirData}
        />
      </Box>
    </WXYCPage>
  );
}
