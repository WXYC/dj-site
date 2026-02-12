import WXYCPage from "@/src/Layout/WXYCPage";
import NowPlaying from "@/src/widgets/NowPlaying";
import { Box } from "@mui/joy";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Listen Live"),
};

export default function LivePage() {
  return (
    <WXYCPage>
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
        <NowPlaying mini={false} />
      </Box>
    </WXYCPage>
  );
}
