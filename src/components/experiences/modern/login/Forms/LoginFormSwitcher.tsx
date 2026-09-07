"use client";

import { isStationSignupEnabled } from "@/lib/features/authentication/flags";
import { applicationSlice } from "@/lib/features/application/frontend";
import { getPreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { hasSignupParam } from "@/src/utilities/loginHref";
import { useSearchParams } from "next/navigation";
import WelcomeQuotes, {
  type WelcomeQuote,
} from "@/src/components/experiences/modern/login/Quotes/Welcome";
import { isValidEmail } from "@wxyc/shared/validation";
import { useLayoutEffect, useRef, useState } from "react";
import EmailOTPForm from "./EmailOTPForm";
import OTPCodeForm from "./OTPCodeForm";
import QRCodeForm from "./QRCodeForm";
import StationSignupForm from "./StationSignupForm";
import UserPasswordForm from "./UserPasswordForm";

export default function LoginFormSwitcher({
  welcomeQuote,
}: {
  welcomeQuote: WelcomeQuote;
}) {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const authStage = useAppSelector(applicationSlice.selectors.getAuthStage);
  const [otpState, setOtpState] = useState<{ identifier: string; email: string }>({ identifier: "", email: "" });
  const hasSyncedRef = useRef(false);

  // Sync before paint so the correct form renders without a flash.
  useLayoutEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    // ?signup=1 is the entry link from outside /login (the landing page), and
    // this is the only place the modern tree reads it. Flag off keeps the
    // param inert — same rule as ClassicLoginSlotSwitcher. Not a sign-in
    // method: never saved as the preferred login method, and one-shot so
    // "Back to sign in" isn't fought after it clears the param. Reset links
    // never reach here — LoginSlotSwitcher routes ?token=/?error= to the
    // reset slot before this mounts — so reset still wins over a stray
    // signup param.
    if (isStationSignupEnabled() && hasSignupParam(searchParams)) {
      if (authStage !== "signup") {
        dispatch(applicationSlice.actions.setAuthStage("signup"));
      }
      return;
    }
    const preferred = getPreferredLoginMethod();
    if (preferred !== authStage) {
      dispatch(applicationSlice.actions.setAuthStage(preferred));
    }
  }, [authStage, dispatch, searchParams]);

  if (authStage === "otp-verify") {
    const displayTarget = isValidEmail(otpState.identifier)
      ? otpState.identifier
      : "your registered email";
    return (
      <OTPCodeForm
        email={otpState.email}
        displayTarget={displayTarget}
        onChangeIdentifier={() => dispatch(applicationSlice.actions.setAuthStage("otp-email"))}
      />
    );
  }

  if (authStage === "qr") {
    return (
      <>
        <WelcomeQuotes quote={welcomeQuote} />
        <QRCodeForm />
      </>
    );
  }

  if (authStage === "signup") {
    return (
      <>
        <WelcomeQuotes quote={welcomeQuote} />
        <StationSignupForm />
      </>
    );
  }

  if (authStage === "password") {
    return (
      <>
        <WelcomeQuotes quote={welcomeQuote} />
        <UserPasswordForm />
      </>
    );
  }

  return (
    <>
      <WelcomeQuotes quote={welcomeQuote} />
      <EmailOTPForm onCodeSent={setOtpState} />
    </>
  );
}
