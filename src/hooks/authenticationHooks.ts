"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authBaseURL, authClient, clearTokenCache, lookupEmailByIdentifier } from "@/lib/features/authentication/client";
import {
  interpretTokenPoll,
  pollDeviceToken,
  requestDeviceCode,
  type PollOutcome,
} from "@/lib/features/authentication/device-auth";
import { isValidEmail } from "@wxyc/shared/validation";
import {
  AuthenticatedUser,
  AuthenticationData,
  isAuthenticated,
  NewUserCredentials,
  ResetPasswordRequest,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { betterAuthSessionToAuthenticationData, betterAuthSessionToAuthenticationDataAsync } from "@/lib/features/authentication/utilities";
import { Authorization } from "@/lib/features/admin/types";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { resetApplication } from "./applicationHooks";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { getOidcRedirectTarget } from "@/src/utilities/oidcRedirectTarget";
import { useAsyncAction } from "./useAsyncAction";
import { safeCapture } from "@/lib/posthog";

/** Observable login/onboarding events (distinct from auth-client errors). */
const LOGIN_EVENTS = {
  /** A login/verification/onboarding succeeded; records where the user was sent. */
  POST_LOGIN_REDIRECT: "login_post_redirect",
} as const;

type LoginMethod = "password" | "otp" | "onboarding" | "qr";

/**
 * How hard we try to confirm the freshly-established session is visible
 * server-side before navigating into a `requireAuth()`-gated route. The client
 * sign-in resolves as soon as the auth response (incl. Set-Cookie) is in hand,
 * but the very next server component render occasionally can't see a valid
 * session yet, so `requireAuth()` bounces the DJ straight back to
 * `/login?bounced=no-session` (WXYC/dj-site login no-session race — 61% of all
 * server bounces in the first month of `login_server_bounce` telemetry). The
 * backend has no read replica or session cache, so a single confirming read
 * that succeeds proves the next server render will resolve the session too.
 */
const SESSION_CONFIRM_ATTEMPTS = 5;
const SESSION_CONFIRM_DELAY_MS = 150;
// Cap on a single confirming read. better-auth's fetch has no default timeout,
// so without this a stalled connection would hang the `await` forever, pinning
// the login button's spinner and stranding the DJ — the exact outcome the
// docstring promises can't happen. A timed-out read counts as "not yet
// visible", so the loop stays bounded (worst case ~5 x (timeout + delay)).
const SESSION_CONFIRM_TIMEOUT_MS = 2000;

/**
 * Poll better-auth until it acknowledges the current session, forcing a fresh
 * server read each time (`disableCookieCache`) so we observe the real verdict
 * rather than a stale client snapshot. Resolves `true` as soon as a user is
 * seen, or `false` once attempts are exhausted — the caller navigates either
 * way so a persistent failure never strands the DJ on the login screen. Each
 * read is time-boxed so a hung request can't defeat that guarantee.
 */
async function confirmSessionVisible(): Promise<boolean> {
  for (let attempt = 1; attempt <= SESSION_CONFIRM_ATTEMPTS; attempt++) {
    // `.catch` sits on the read itself, not around the race: if a read the
    // timeout already beat rejects late, that rejection must resolve to null
    // here rather than surface as an unhandled promise rejection. A transient
    // failure and an empty session are treated the same — retry.
    const session = await Promise.race([
      authClient
        .getSession({ query: { disableCookieCache: true } })
        .catch(() => null),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SESSION_CONFIRM_TIMEOUT_MS),
      ),
    ]);
    if ((session as { data?: { user?: unknown } } | null)?.data?.user) {
      return true;
    }

    if (attempt < SESSION_CONFIRM_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, SESSION_CONFIRM_DELAY_MS),
      );
    }
  }
  return false;
}

/**
 * Send a freshly-authenticated user to the right place and record the choice.
 *
 * Waits for the server to acknowledge the new session (`confirmSessionVisible`)
 * before navigating, closing the no-session race where a client-side "login
 * successful" is immediately undone by a server-side `requireAuth()` bounce.
 *
 * Emits one `login_post_redirect` event with a `destination` discriminator so a
 * PostHog breakdown shows the share of successful logins bounced to the
 * incomplete screen vs. the dashboard. Captures the RAW onboarding flag
 * (incl. null when absent) so a complete DJ misrouted because the flag came
 * back undefined is distinguishable from a genuinely-incomplete account, plus
 * `session_confirmed` so a residual race (server never acknowledged the
 * session) stays visible in telemetry instead of looking fixed.
 *
 * When the confirm gate fails for a dashboard-bound login, we `refresh()`
 * rather than `push()` into a redirect we already know will bounce: pushing to
 * the dashboard would only hit `/login?bounced=no-session`, which then trips the
 * `SessionEndedNotice` toast — a "your session has ended" message contradicting
 * the "Login successful" the DJ just saw. A refresh lets the `/login` layout be
 * the authority: it forwards to the dashboard if the session became visible, or
 * re-shows the form to retry if not. Never strands the DJ either way.
 */
async function redirectAfterAuth(
  router: { push: (href: string) => void; refresh: () => void },
  user: { id?: string; hasCompletedOnboarding?: boolean } | undefined,
  method: LoginMethod,
  oidcTarget?: string,
): Promise<void> {
  const dashboardHome = String(
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog",
  );
  const incomplete = user?.hasCompletedOnboarding === false;

  const sessionConfirmed = await confirmSessionVisible();

  safeCapture(LOGIN_EVENTS.POST_LOGIN_REDIRECT, {
    method,
    destination: incomplete ? "incomplete" : oidcTarget ? "oidc" : "dashboard",
    has_completed_onboarding: user?.hasCompletedOnboarding ?? null,
    user_id: user?.id ?? null,
    session_confirmed: sessionConfirmed,
  });

  if (!incomplete && !sessionConfirmed) {
    router.refresh();
    return;
  }

  if (!incomplete && oidcTarget) {
    // Hand off to the authorize endpoint with a full document navigation.
    // In production `authBaseURL` is the same-origin `/auth` proxy (a
    // next.config rewrite, not an app route), so `router.push` would treat
    // this as an internal soft navigation and fire a background RSC fetch
    // that hits `/oauth2/authorize` — burning the one-time OIDC code before
    // the user ever leaves the page. `window.location.assign` leaves the
    // SPA cleanly, so `router.refresh()` is moot.
    window.location.assign(oidcTarget);
    return;
  }

  router.push(incomplete ? "/login?incomplete=true" : dashboardHome);
  router.refresh();
}

export const useLogin = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { execute, isLoading, error } = useAsyncAction();

  const verified = useAppSelector(
    authenticationSlice.selectors.allCredentialsVerified
  );

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return execute(async () => {
      const identifier = e.currentTarget.username.value;
      const password = e.currentTarget.password.value;

      // Drop any prior session's cached bearer before establishing this one (WXYC/dj-site#596).
      clearTokenCache();

      const result = isValidEmail(identifier)
        ? ((await authClient.signIn.email({ email: identifier, password })) as { error?: unknown })
        : ((await authClient.signIn.username({ username: identifier, password })) as { error?: unknown });

      if (result.error) {
        const errorMessage = result.error instanceof Error
          ? result.error.message
          : typeof result.error === 'string'
            ? result.error
            : (result.error as any)?.message || 'Login failed. Please check your credentials.';
        throw new Error(errorMessage);
      }

      toast.success("Login successful");

      const user = (result as any).data?.user;
      // If we got here as part of an OIDC authorize bounce, resume the
      // round-trip by handing off to `${authBase}/oauth2/authorize?<original-query>`
      // instead of the dashboard. See `getOidcRedirectTarget` for the contract.
      const oidcTarget = getOidcRedirectTarget(
        searchParams ?? new URLSearchParams(),
        authBaseURL,
      );
      await redirectAfterAuth(router, user, "password", oidcTarget ?? undefined);
    }, "An unexpected error occurred during login. Please try again.");
  };

  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(authenticationSlice.actions.reset());
  }, []);

  return {
    handleLogin,
    verified,
    authenticating: isLoading,
    error,
  };
};

export const useOTPRequest = () => {
  const { execute, isLoading, error } = useAsyncAction();

  const handleSendOTP = async (identifier: string): Promise<{ email: string }> => {
    const result = await execute(async () => {
      const email = await lookupEmailByIdentifier(identifier);
      if (!email) {
        throw new Error("No account matches that username or email.");
      }

      const sendResult = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      throwIfBetterAuthError(sendResult as any, "Failed to send login code");

      toast.success("Login code sent! Check your email.");
      return { email };
    }, "Failed to send login code. Please try again.");

    if (!result) {
      throw new Error("Failed to send login code");
    }
    return result;
  };

  return { handleSendOTP, isLoading, error };
};

export const useOTPVerify = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { execute, isLoading, error } = useAsyncAction();

  const handleVerifyOTP = (email: string, otp: string) =>
    execute(async () => {
      // Drop any prior session's cached bearer before establishing this one (WXYC/dj-site#596).
      clearTokenCache();

      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      });

      if ((result as any).error) {
        const err = (result as any).error;
        const code = err?.code || "";

        const friendlyMessages: Record<string, string> = {
          OTP_EXPIRED: "That code has expired. Please request a new one.",
          INVALID_OTP: "Invalid code. Please check and try again.",
          TOO_MANY_ATTEMPTS: "Too many attempts. Please request a new code.",
        };

        const errorMessage = friendlyMessages[code] || err?.message || "Verification failed. Please try again.";
        throw new Error(errorMessage);
      }

      toast.success("Login successful");

      const user = (result as any).data?.user;
      // Mirror useLogin's OIDC resume contract — both credential entry
      // points feed the same authorize round-trip.
      const oidcTarget = getOidcRedirectTarget(
        searchParams ?? new URLSearchParams(),
        authBaseURL,
      );
      await redirectAfterAuth(router, user, "otp", oidcTarget ?? undefined);
    }, "Verification failed. Please try again.");

  const handleResendOTP = async (email: string) => {
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      toast.success("Code resent! Check your email.");
    } catch {
      toast.error("Failed to resend code. Please try again.");
    }
  };

  return { handleVerifyOTP, handleResendOTP, isLoading, error };
};

/** UI-facing lifecycle state of the QR device-authorization flow. */
export type DeviceAuthorizationStatus =
  | "loading"
  | "waiting"
  | "expired"
  | "denied"
  | "error";

/**
 * Drive the RFC 8628 QR sign-in flow for the shared control-room browser.
 *
 * On mount (and on {@link restart}) it POSTs `/auth/device/code`, surfaces the
 * `user_code` + `verification_uri_complete` for the QR, then polls
 * `/auth/device/token` at the server-returned interval until the DJ approves
 * on their phone or the code reaches a terminal state.
 */
export const useDeviceAuthorization = () => {
  const router = useRouter();
  const [status, setStatus] = useState<DeviceAuthorizationStatus>("loading");
  const [userCode, setUserCode] = useState<string | undefined>(undefined);
  const [verificationUriComplete, setVerificationUriComplete] = useState<
    string | undefined
  >(undefined);
  const [restartNonce, setRestartNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clientId =
      process.env.NEXT_PUBLIC_DEVICE_AUTH_CLIENT_ID || "dj-site";

    // Reset to a clean slate so a restart visibly returns to "loading".
    setStatus("loading");
    setUserCode(undefined);
    setVerificationUriComplete(undefined);

    (async () => {
      let code;
      try {
        code = await requestDeviceCode(clientId);
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;

      setUserCode(code.user_code);
      setVerificationUriComplete(code.verification_uri_complete);
      setStatus("waiting");

      // Fall back to the RFC 8628 default (5s) if the server omits or garbles
      // `interval`: a NaN/0 here would make `setTimeout(poll, …)` fire at 0ms
      // and flood the token endpoint.
      let intervalMs =
        (Number.isFinite(code.interval) && code.interval > 0
          ? code.interval
          : 5) * 1000;

      const schedule = () => {
        timer = setTimeout(poll, intervalMs);
      };

      const poll = async () => {
        let outcome: PollOutcome;
        try {
          const { status: httpStatus, body } = await pollDeviceToken(
            code.device_code,
            clientId,
          );
          outcome = interpretTokenPoll(httpStatus, body);
        } catch {
          outcome = { kind: "error", code: "network" };
        }
        if (cancelled) return;

        if (outcome.kind === "pending") {
          schedule();
        } else if (outcome.kind === "slow_down") {
          intervalMs += 5000;
          schedule();
        } else if (outcome.kind === "success") {
          // The successful poll set the session cookie; drop any stale cached
          // bearer (WXYC/dj-site#596), then read the user back off the session.
          clearTokenCache();
          let user:
            | { id?: string; hasCompletedOnboarding?: boolean }
            | undefined;
          try {
            const session = (await authClient.getSession()) as {
              data?: { user?: { id?: string; hasCompletedOnboarding?: boolean } };
            };
            user = session?.data?.user;
          } catch {
            // Auth already succeeded (the poll set the session cookie); if the
            // user read fails, still navigate. redirectAfterAuth's confirm gate
            // and the destination's own requireAuth resolve the session
            // server-side — never strand the DJ on a frozen QR after sign-in.
            user = undefined;
          }
          if (cancelled) return;
          await redirectAfterAuth(router, user, "qr");
        } else if (outcome.kind === "expired") {
          setStatus("expired");
        } else if (outcome.kind === "denied") {
          setStatus("denied");
        } else {
          toast.error("Something went wrong signing in. Please try again.");
          setStatus("error");
        }
      };

      schedule();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Intentionally keyed only on `restartNonce`: the flow must start exactly
    // once per mount and once per restart(). `router` is deliberately omitted —
    // its identity is not guaranteed stable, and re-running this effect (which
    // requests a fresh device code) whenever the router changes would restart
    // the QR flow mid-poll.
  }, [restartNonce]);

  const restart = useCallback(() => setRestartNonce((n) => n + 1), []);

  return { userCode, verificationUriComplete, status, restart };
};

export const useLogout = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { execute, isLoading } = useAsyncAction();

  const handleLogout = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    return execute(async () => {
      // Invalidate the cached bearer synchronously so the next caller — including
      // any in-flight code paths that race ahead of signOut — cannot reuse the
      // departing user's JWT (cache TTL is 4 minutes; see WXYC/dj-site#596).
      clearTokenCache();
      await authClient.signOut();
      resetApplication(dispatch);
      // Navigate to a clean /login ourselves. Leaning on router.refresh() to let
      // the dashboard's requireAuth() redirect us would route a deliberate logout
      // through /login?bounced=no-session, firing a false-positive
      // login_server_bounce event and showing the DJ an error-looking URL.
      // replace() (not push()) so the now-unauthorized dashboard isn't left in
      // history, and so it collapses with callers like AuthBackButton that
      // already replace() to /login before awaiting logout.
      router.replace("/login");
      router.refresh();
    }, "Failed to logout. Please try again.");
  };

  return {
    handleLogout,
    loggingOut: isLoading,
  };
};

export const useAuthentication = () => {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [authData, setAuthData] = useState<AuthenticationData>(
    session
      ? betterAuthSessionToAuthenticationData(session as any)
      : { message: "Not Authenticated" }
  );
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  // Fetch organization role when session is available
  useEffect(() => {
    if (session && !isPending) {
      setIsLoadingRole(true);
      betterAuthSessionToAuthenticationDataAsync(session as any)
        .then((data) => {
          setAuthData(data);
        })
        .catch((error) => {
          console.error("Failed to fetch organization role, using session data:", error);
          // Fall back to synchronous version on error
          setAuthData(betterAuthSessionToAuthenticationData(session as any));
        })
        .finally(() => {
          setIsLoadingRole(false);
        });
    } else if (!session) {
      setAuthData({ message: "Not Authenticated" });
    }
  }, [session, isPending]);

  return {
    data: authData,
    authenticating: isPending || isLoadingRole,
    authenticated: session ? isAuthenticated(authData) : false,
    error: sessionError ? (sessionError as Error) : null,
  };
};

export const useRegistry = () => {
  const { data, authenticated, authenticating } = useAuthentication();

  // Return user data from better-auth session instead of fetching from DJ Registry API
  const user = isAuthenticated(data) ? data.user : null;

  const info = user ? {
    id: user.id!, // User ID (string) - backend now accepts this instead of numeric DJ ID
    real_name: user.realName || undefined,
    dj_name: user.djName || undefined,
  } : null;

  return {
    loading: authenticating || !authenticated,
    info: info,
  };
};

export const useNewUser = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const { handleLogout } = useLogout();

  const { execute, isLoading, error } = useAsyncAction();

  const handleNewUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return execute(async () => {
      const username = e.currentTarget.username.value;
      const password = e.currentTarget.password.value;
      const currentPassword = String(
        process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || ""
      );

      if (!currentPassword) {
        throw new Error("Missing onboarding temp password configuration.");
      }

      const params: NewUserCredentials = {
        username,
        password,
      };

      const realNameValue = e.currentTarget.realName?.value || "";
      const djNameValue = e.currentTarget.djName?.value || "";

      if (realNameValue) {
        params.realName = realNameValue;
      }
      if (djNameValue) {
        params.djName = djNameValue;
      }

      const session = await authClient.getSession();
      if (!session.data?.user?.id) {
        throw new Error("You must be authenticated to update your profile");
      }

      // Change the password BEFORE flipping hasCompletedOnboarding. If we
      // flip the flag first and then changePassword fails, the account ends
      // up flagged complete but still protected only by the publicly-known
      // NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD — and requireAuth() will no
      // longer redirect the user back through onboarding to recover. See
      // WXYC/dj-site#598.
      if (params.password) {
        const passwordResult = await authClient.changePassword({
          currentPassword,
          newPassword: params.password,
        });

        throwIfBetterAuthError(passwordResult, "Failed to update password");
      }

      const updateRequest: any = { hasCompletedOnboarding: true };
      if (params.realName) {
        updateRequest.realName = params.realName;
      }
      if (params.djName) {
        updateRequest.djName = params.djName;
      }
      const result = await authClient.updateUser(updateRequest);

      throwIfBetterAuthError(result, "Failed to update user profile");

      toast.success("Profile updated successfully");
      await redirectAfterAuth(
        router,
        { id: session.data.user.id, hasCompletedOnboarding: true },
        "onboarding",
      );
    }, "Failed to update user profile. Please try again.");
  };

  useEffect(() => {
    dispatch(authenticationSlice.actions.reset());
  }, []);

  const addRequiredCredentials = (required: (keyof VerifiedData)[]) =>
    dispatch(authenticationSlice.actions.addRequiredCredentials(required));

  return {
    handleNewUser,
    verified,
    authenticating: isLoading,
    addRequiredCredentials,
    error,
  };
};

export const useResetPassword = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { execute: executeRequest, isLoading: requestingReset, error: requestError } = useAsyncAction();
  const { execute: executeReset, isLoading, error: resetError } = useAsyncAction();

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const handleRequestReset = (email: string) =>
    executeRequest(async () => {
      if (!email) {
        throw new Error("Please enter your email address");
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;

      const result = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });

      throwIfBetterAuthError(result, "Failed to request password reset");

      toast.success(result.data?.message || "If this email exists, check for a reset link.");
      dispatch(applicationSlice.actions.setAuthStage("otp-email"));
      router.push("/login");
    }, "Failed to request password reset. Please try again.");

  const handleReset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return executeReset(async () => {
      const token = e.currentTarget.token?.value;
      const password = e.currentTarget.password.value;

      if (!token || !password) {
        throw new Error("All fields are required");
      }

      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      throwIfBetterAuthError(result, "Password reset failed");

      toast.success("Password reset successfully. Please log in.");
      dispatch(applicationSlice.actions.setAuthStage("otp-email"));
      router.push("/login");
      router.refresh();
    }, "Password reset failed. Please try again.");
  };

  return {
    handleReset,
    handleRequestReset,
    verified,
    requestingReset,
    error: requestError || resetError,
  };
};
