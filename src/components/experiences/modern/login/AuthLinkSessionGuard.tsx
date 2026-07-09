"use client";

import { authClient, clearTokenCache } from "@/lib/features/authentication/client";
import { CircularProgress, Stack, Typography } from "@mui/joy";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type AuthLinkSessionGuardProps = {
  /** Non-empty when the URL carries an invite or password-reset token. */
  linkToken: string;
  loadingMessage?: string;
  children: ReactNode;
};

/**
 * Email link flows (invite onboarding, password reset) must not run under
 * another user's session — common on shared station machines. Clears any
 * existing session before the linked form is shown.
 */
export default function AuthLinkSessionGuard({
  linkToken,
  loadingMessage = "Preparing…",
  children,
}: AuthLinkSessionGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    const prepareLinkSession = async () => {
      const session = await authClient.getSession();
      if (session.error) {
        return;
      }

      if (session.data?.user?.id) {
        clearTokenCache();
        const signOut = await authClient.signOut();
        if (signOut?.error) {
          return;
        }
      }

      if (!cancelled) {
        router.refresh();
        setReady(true);
      }
    };

    void prepareLinkSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh identity is stable; linkToken is the only intentional trigger
  }, [linkToken]);

  if (!ready) {
    return (
      <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
        <CircularProgress />
        <Typography level="body-sm">{loadingMessage}</Typography>
      </Stack>
    );
  }

  return <>{children}</>;
}
