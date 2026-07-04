"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authClient, clearTokenCache, lookupEmailByIdentifier } from "@/lib/features/authentication/client";
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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resetApplication } from "./applicationHooks";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { useAsyncAction } from "./useAsyncAction";
import { safeCapture } from "@/lib/posthog";

/** Observable login/onboarding events (distinct from auth-client errors). */
const LOGIN_EVENTS = {
  /** A login/verification/onboarding succeeded; records where the user was sent. */
  POST_LOGIN_REDIRECT: "login_post_redirect",
} as const;

type LoginMethod = "password" | "otp" | "onboarding";

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

/**
 * Poll better-auth until it acknowledges the current session, forcing a fresh
 * server read each time (`disableCookieCache`) so we observe the real verdict
 * rather than a stale client snapshot. Resolves `true` as soon as a user is
 * seen, or `false` once attempts are exhausted — the caller navigates either
 * way so a persistent failure never strands the DJ on the login screen.
 */
async function confirmSessionVisible(): Promise<boolean> {
  for (let attempt = 1; attempt <= SESSION_CONFIRM_ATTEMPTS; attempt++) {
    try {
      const session = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      if ((session as { data?: { user?: unknown } } | null)?.data?.user) {
        return true;
      }
    } catch {
      // Transient fetch/parse failure — fall through and retry.
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
 */
async function redirectAfterAuth(
  router: { push: (href: string) => void; refresh: () => void },
  user: { id?: string; hasCompletedOnboarding?: boolean } | undefined,
  method: LoginMethod,
): Promise<void> {
  const dashboardHome = String(
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog",
  );
  const incomplete = user?.hasCompletedOnboarding === false;

  const sessionConfirmed = await confirmSessionVisible();

  safeCapture(LOGIN_EVENTS.POST_LOGIN_REDIRECT, {
    method,
    destination: incomplete ? "incomplete" : "dashboard",
    has_completed_onboarding: user?.hasCompletedOnboarding ?? null,
    user_id: user?.id ?? null,
    session_confirmed: sessionConfirmed,
  });

  router.push(incomplete ? "/login?incomplete=true" : dashboardHome);
  router.refresh();
}

export const useLogin = () => {
  const router = useRouter();
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
      await redirectAfterAuth(router, user, "password");
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
      await redirectAfterAuth(router, user, "otp");
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
      router.push("/login");
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
