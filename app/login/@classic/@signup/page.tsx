import StationSignupForm from "@/src/components/experiences/modern/login/Forms/StationSignupForm";

/**
 * Classic reuses the modern StationSignupForm rather than reimplementing the
 * passcode + account-details flow, the same way @reset reuses
 * PasswordResetForms — station signup has no tubafrenzy screen to mirror.
 */
export default function ClassicStationSignupPage() {
  return <StationSignupForm />;
}
