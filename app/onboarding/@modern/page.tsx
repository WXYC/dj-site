import { redirect } from "next/navigation";
import OnboardingForm from "@/src/components/experiences/modern/login/Forms/OnboardingForm";
import OnboardingInviteSessionGuard from "@/src/components/experiences/modern/login/OnboardingInviteSessionGuard";
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

/**
 * Invite-token onboarding. Requires ?token= from the invite email; signed-in
 * incomplete users complete onboarding at /login?incomplete=true instead.
 * better-auth redirects here with ?error=INVALID_TOKEN (and no token) when
 * the link is expired.
 */
export default async function ModernOnboardingPage({ searchParams }: OnboardingPageProps) {
  const { token, error } = await searchParams;

  if (!token && !error) {
    redirect("/login");
  }

  return (
    <WXYCPage>
      <HoldOnQuotes />
      {error && (
        <Alert color="danger" sx={{ mb: 2 }}>
          This setup link is invalid or expired. Ask your station manager to resend the invite.
        </Alert>
      )}
      {token && (
        <OnboardingInviteSessionGuard inviteToken={token}>
          <OnboardingForm />
        </OnboardingInviteSessionGuard>
      )}
    </WXYCPage>
  );
}
