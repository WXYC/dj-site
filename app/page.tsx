import WelcomeQuotes, {
  pickWelcomeQuote,
} from "@/src/components/experiences/modern/login/Quotes/Welcome";
import WXYCPage from "@/src/Layout/WXYCPage";
import { isStationSignupEnabled } from "@/lib/features/authentication/flags";
import { loginHrefWithSignup } from "@/src/utilities/loginHref";
import { Button, Divider, Link as JoyLink, Stack } from "@mui/joy";
import Link from "next/link";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";

export const metadata: Metadata = {
  title: getPageTitle("DJ Site"),
};

export default async function HomePage() {
  const session = await getServerSession();
  if (session?.user?.emailVerified) {
    redirect(
      process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE
    );
  }
  return (
    <WXYCPage>
      <Stack
        direction="column"
        spacing={2}
        alignItems="center"
        sx={{ height: "100%" }}
      >
        <WelcomeQuotes quote={pickWelcomeQuote()} />
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
        <Link href="/playlists" style={{ width: "100%" }}>
          <Button variant="outlined" color="neutral" fullWidth>
            Playlist Archive
          </Button>
        </Link>
        {isStationSignupEnabled() && (
          // next/link wraps a span rather than taking `component={JoyLink}` or
          // Joy taking `component={Link}`: this is a server component, and a
          // component reference is a function, which cannot cross into a
          // client component. Passing one renders as a request-time error on
          // every visit to the site root.
          //
          // null params: this page sits outside the /login OIDC bounce, so
          // there are no live authorize params to carry into the detour.
          <Link href={loginHrefWithSignup(null)} style={{ textDecoration: "none" }}>
            <JoyLink component="span" level="body-sm">
              Sign Up
            </JoyLink>
          </Link>
        )}
      </Stack>
    </WXYCPage>
  );
}
