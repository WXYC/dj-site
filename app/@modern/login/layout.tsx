import { AuthenticationStage } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import Box from "@mui/joy/Box";
import { BackgroundBox, BackgroundImage } from "./components/Layout/Background";
import Header from "./components/Layout/Header";
import Main from "./components/Layout/Main";
import Footer from "./components/Layout/Footer";

export default async function ModernLoginLayout({
  normal,
  reset,
}: {
  normal: React.ReactNode;
  reset: React.ReactNode;
}) {
  const serverSideProps = await createServerSideProps();

  return (
    <Box sx={{ height: "100%" }}>
      <BackgroundBox>
        <Header />
        <Main>
          {serverSideProps.authentication?.stage ==
          AuthenticationStage.NewPassword
            ? reset
            : normal}
        </Main>
        <Footer />
      </BackgroundBox>
      <BackgroundImage />
    </Box>
  );
}
