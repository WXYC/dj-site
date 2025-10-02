import AuthBackButton from "@/src/components/modern/login/Forms/AuthBackButton";
import NewUserForm from "@/src/components/modern/login/Forms/NewUserForm";
import HoldOnQuotes from "@/src/components/modern/login/Quotes/HoldOn";
import WXYCPage from "@/src/Layout/WXYCPage";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: onboardingToken } = await searchParams;

  if (!onboardingToken) {
    return (
      <WXYCPage title="Invalid Onboarding Link">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1>Invalid Onboarding Link</h1>
          <p>This onboarding link is invalid or has expired.</p>
          <p>Please contact an administrator for a new onboarding link.</p>
          <AuthBackButton text="Go to Login" />
        </div>
      </WXYCPage>
    );
  }

  return (
    <WXYCPage title="Complete Your Account Setup">
      <AuthBackButton text="Login with a different account" />
      <HoldOnQuotes />
      <NewUserForm 
        username="" // Will be populated from token validation
        requiredAttributes={["realName", "djName"]}
        onboardingToken={onboardingToken}
      />
    </WXYCPage>
  );
}