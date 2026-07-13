import { redirect } from "next/navigation";
import Header from "@/src/components/experiences/classic/login/Layout/Header";
import OnboardingForm from "@/src/components/experiences/modern/login/Forms/OnboardingForm";
import AuthLinkSessionGuard from "@/src/components/experiences/modern/login/AuthLinkSessionGuard";

type ClassicOnboardingPageProps = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

/**
 * Invite-token onboarding (classic experience). Requires ?token= from the
 * invite email; signed-in incomplete users complete onboarding at
 * /login?incomplete=true instead.
 */
export default async function ClassicOnboardingPage({ searchParams }: ClassicOnboardingPageProps) {
  const { token, error } = await searchParams;

  if (!token && !error) {
    redirect("/login");
  }

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Header />
      {error && (
        <p>This setup link is invalid or expired. Ask your station manager to resend the invite.</p>
      )}
      {token && !error && (
        <AuthLinkSessionGuard
          linkToken={token}
          loadingMessage="Preparing your account setup…"
        >
          <OnboardingForm />
        </AuthLinkSessionGuard>
      )}
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
