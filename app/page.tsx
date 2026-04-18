import WelcomeQuotes from "@/src/components/experiences/modern/login/Quotes/Welcome";
import WXYCPage from "@/src/Layout/WXYCPage";
import { Button, Divider, Stack } from "@mui/joy";
import Link from "next/link";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: getPageTitle("DJ Site"),
};

export default async function HomePage() {
  const session = await getServerSession();
  if (session) {
    redirect("/dashboard");
  }
  return (
    <WXYCPage>
      <Stack
        direction="column"
        spacing={2}
        alignItems="center"
        sx={{ height: "100%" }}
      >
        <WelcomeQuotes />
        <Divider />
        <Link href="/login" style={{ width: "100%" }}>
          <Button variant="solid" color="primary" fullWidth>
            Log In
          </Button>
        </Link>
        <Link href="/live" style={{ width: "100%" }}>
          <Button variant="solid" color="neutral" fullWidth>
            Listen
          </Button>
        </Link>
      </Stack>
    </WXYCPage>
  );
}
