import StationSignupForm from "@/src/components/experiences/modern/login/Forms/StationSignupForm";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

/**
 * Classic reuses the modern StationSignupForm rather than reimplementing the
 * passcode + account-details flow, the same way @reset reuses
 * PasswordResetForms — station signup has no tubafrenzy screen to mirror.
 */
export default function ClassicStationSignupPage() {
  return <StationSignupForm />;
}
