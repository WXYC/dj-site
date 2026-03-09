import { getServerSession } from "@/lib/features/authentication/server-utils";
import { redirect } from "next/navigation";
import OnboardingForm from "@/src/components/experiences/modern/login/Forms/OnboardingForm";
import WXYCPage from "@/src/Layout/WXYCPage";
import HoldOnQuotes from "@/src/components/experiences/modern/login/Quotes/HoldOn";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Onboarding"),
};

export default async function ModernOnboardingPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const username =
    session.user.username ||
    session.user.name ||
    session.user.email?.split("@")[0] ||
    "";

  return (
    <WXYCPage>
      <HoldOnQuotes />
      <OnboardingForm
        username={username}
        realName={session.user.realName || undefined}
        djName={session.user.djName || undefined}
      />
    </WXYCPage>
  );
}
