import { Box } from "@mui/joy";
import { BackgroundBox, BackgroundImage } from "./Background";
import Header from "./Header";
import Main from "./Main";
import Footer from "./Footer";
import PageData from "./PageData";

export default function WXYCPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ height: "100%" }} className="ignoreClassic">
      <BackgroundBox>
        <PageData title={title} />
        <Header />
        <Main>{children}</Main>
        <Footer />
      </BackgroundBox>
      <BackgroundImage />
    </Box>
  );
}
