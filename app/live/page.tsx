import WXYCPage from "@/src/Layout/WXYCPage";
import NowPlaying from "@/src/widgets/NowPlaying";
import { Box, Card } from "@mui/joy";

export default function LivePage() {
  return (
    <WXYCPage title="Listen Live">
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
