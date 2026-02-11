import { Box } from "@mui/joy";
import { BackgroundBox, BackgroundImage } from "./Background";
import Header from "./Header";
import Main from "./Main";
import Footer from "./Footer";

export default function WXYCPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ height: "100%" }} className="ignoreClassic">
      <BackgroundBox>
        <Header />
        <Main>{children}</Main>
        <Footer />
      </BackgroundBox>
      <BackgroundImage />
    </Box>
  );
}
