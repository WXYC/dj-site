"use client";

import { authClient, clearTokenCache } from "@/lib/features/authentication/client";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type OnboardingInviteSessionGuardProps = {
  inviteToken: string;
  children: ReactNode;
};

/**
 * Invite onboarding must not run under another user's session (e.g. an admin
 * opening a new DJ's setup link). Clears any existing session before the form
 * is shown so profile fields and post-submit auth are for the invited account.
 */
export default function OnboardingInviteSessionGuard({
  inviteToken,
  children,
}: OnboardingInviteSessionGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const prepareInviteSession = async () => {
      try {
        const session = await authClient.getSession();
        if (session.data?.user?.id) {
          clearTokenCache();
          await authClient.signOut();
        }
      } finally {
        if (!cancelled) {
          router.refresh();
          setReady(true);
        }
      }
    };

    void prepareInviteSession();

    return () => {
      cancelled = true;
    };
  }, [inviteToken, router]);

  if (!ready) {
    return (
      <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
        <CircularProgress />
        <Typography level="body-sm">Preparing your account setup…</Typography>
      </Stack>
    );
  }

  return <>{children}</>;
}
