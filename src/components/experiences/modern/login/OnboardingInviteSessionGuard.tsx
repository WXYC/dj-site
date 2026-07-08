"use client";

import AuthLinkSessionGuard from "./AuthLinkSessionGuard";
import type { ReactNode } from "react";

type OnboardingInviteSessionGuardProps = {
  inviteToken: string;
  children: ReactNode;
};

/** @see AuthLinkSessionGuard */
export default function OnboardingInviteSessionGuard({
  inviteToken,
  children,
}: OnboardingInviteSessionGuardProps) {
  return (
    <AuthLinkSessionGuard
      linkToken={inviteToken}
      loadingMessage="Preparing your account setup…"
    >
      {children}
    </AuthLinkSessionGuard>
  );
}
