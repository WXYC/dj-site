import WXYCPage from "@/src/Layout/WXYCPage";
import NowPlaying from "@/src/widgets/NowPlaying";
import { Card } from "@mui/joy";

export default function LivePage() {
  return (
    <WXYCPage title="Listen Live">
      <Card
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "clamp(300px, 100%, 600px)",
          p: 2,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(255 255 255 / 0.6)",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <NowPlaying mini={false} />
      </Card>
    </WXYCPage>
  );
}
