import NowPlaying from "@/src/widgets/NowPlaying";
import { Box, Card, Sheet } from "@mui/joy";
import Logo from "@/src/components/Branding/Logo";
import { BackgroundImage } from "../login/@modern/components/Layout/Background";

export default function LivePage() {
  return (
    <Sheet
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
        <Box
            sx = {{
                position: "absolute",
                top: 0,
                left: { sm: "50%", md: 0 },
                transform: { sm: "translateX(-50%)", md: "none" },
                zIndex: 2,
            }}
        >
        <Logo />
        </Box>
      <BackgroundImage />
      <Card
        sx={{
          width: "clamp(300px, 100%, 600px)",
          p: 2,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(255 255 255 / 0.6)",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <NowPlaying mini={false} />
      </Card>
    </Sheet>
  );
}
