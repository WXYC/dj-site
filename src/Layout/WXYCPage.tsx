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
  // Everything above this box clips its overflow so the dashboard can own its
  // internal scroll regions, which leaves the public pages no scrollport unless
  // they carry one themselves.
  return (
    <Box sx={{ height: "100%", overflowY: "auto" }} className="ignoreClassic">
      <BackgroundBox>
        <Header />
        <Main>{children}</Main>
        <Footer />
      </BackgroundBox>
      <BackgroundImage />
    </Box>
  );
}
