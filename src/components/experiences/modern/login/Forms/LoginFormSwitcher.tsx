"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import WelcomeQuotes from "@/src/components/experiences/modern/login/Quotes/Welcome";
import { useState } from "react";
import EmailOTPForm from "./EmailOTPForm";
import OTPCodeForm from "./OTPCodeForm";
import UserPasswordForm from "./UserPasswordForm";

export default function LoginFormSwitcher() {
  const dispatch = useAppDispatch();
  const authStage = useAppSelector(applicationSlice.selectors.getAuthStage);
  const [otpEmail, setOtpEmail] = useState("");

  if (authStage === "otp-verify") {
    return (
      <OTPCodeForm
        email={otpEmail}
        onChangeEmail={() => dispatch(applicationSlice.actions.setAuthStage("otp-email"))}
      />
    );
  }

  if (authStage === "password") {
    return (
      <>
        <WelcomeQuotes />
        <UserPasswordForm />
      </>
    );
  }

  // Default: otp-email
  return (
    <>
      <WelcomeQuotes />
      <EmailOTPForm onCodeSent={setOtpEmail} />
    </>
  );
}
