import Logo from "@/src/components/Branding/Logo";
import { Box, Sheet } from "@mui/joy";
import NotFoundCard from "../src/components/NotFoundCard";
import { BackgroundImage } from "./login/@modern/components/Layout/Background";

export const runtime = "edge";

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
        background: "background.level2",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: { sm: "50%", md: 0 },
          transform: { sm: "translateX(-50%)", md: "none" },
          zIndex: 2,
          height: { xs: "10vh", sm: "20vh", md: "20vh" },
        }}
      >
        <Logo />
      </Box>
      <BackgroundImage />
      <NotFoundCard />
    </Sheet>
  );
}
