import WelcomeQuotes from "@/src/components/experiences/modern/login/Quotes/Welcome";
import WXYCPage from "@/src/Layout/WXYCPage";
import { Button, Divider, Stack } from "@mui/joy";
import Link from "next/link";

export default function HomePage() {
  return (
    <WXYCPage title="DJ Site">
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
