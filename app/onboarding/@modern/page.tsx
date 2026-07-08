import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import OnboardingForm from "@/src/components/experiences/modern/login/Forms/OnboardingForm";
import WXYCPage from "@/src/Layout/WXYCPage";
import HoldOnQuotes from "@/src/components/experiences/modern/login/Quotes/HoldOn";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { Alert } from "@mui/joy";

export const metadata: Metadata = {
  title: getPageTitle("Onboarding"),
};

type OnboardingPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function ModernOnboardingPage({ searchParams }: OnboardingPageProps) {
  const { token, error } = await searchParams;
  const session = await getServerSession();

  if (!session && !token) {
    redirect("/login");
  }

  const username =
    session?.user.username ||
    session?.user.name ||
    session?.user.email?.split("@")[0] ||
    "";

  return (
    <WXYCPage>
      <HoldOnQuotes />
      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          This setup link is invalid or expired. Ask your station manager to resend the invite.
        </Alert>
      )}
      <OnboardingForm
        username={username}
        realName={session?.user.realName || undefined}
        djName={session?.user.djName || undefined}
      />
    </WXYCPage>
  );
}
