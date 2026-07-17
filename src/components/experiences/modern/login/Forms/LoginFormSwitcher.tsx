"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { getPreferredLoginMethod } from "@/lib/features/application/login-method-storage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import WelcomeQuotes, {
  type WelcomeQuote,
} from "@/src/components/experiences/modern/login/Quotes/Welcome";
import { isValidEmail } from "@wxyc/shared/validation";
import { useLayoutEffect, useRef, useState } from "react";
import EmailOTPForm from "./EmailOTPForm";
import OTPCodeForm from "./OTPCodeForm";
import QRCodeForm from "./QRCodeForm";
import UserPasswordForm from "./UserPasswordForm";

export default function LoginFormSwitcher({
  welcomeQuote,
}: {
  welcomeQuote: WelcomeQuote;
}) {
  const dispatch = useAppDispatch();
  const authStage = useAppSelector(applicationSlice.selectors.getAuthStage);
  const [otpState, setOtpState] = useState<{ identifier: string; email: string }>({ identifier: "", email: "" });
  const hasSyncedRef = useRef(false);

  // Sync before paint so the correct form renders without a flash.
  useLayoutEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    const preferred = getPreferredLoginMethod();
    if (preferred !== authStage) {
      dispatch(applicationSlice.actions.setAuthStage(preferred));
    }
  }, [authStage, dispatch]);

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
