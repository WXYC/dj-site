"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authBaseURL, authClient, clearTokenCache, completeOnboarding, lookupEmailByIdentifier } from "@/lib/features/authentication/client";
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
  ResetPasswordRequest,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { betterAuthSessionToAuthenticationData, betterAuthSessionToAuthenticationDataAsync } from "@/lib/features/authentication/utilities";
import { Authorization } from "@/lib/features/admin/types";
import { DEFAULT_DASHBOARD_HOME_PAGE } from "@/lib/features/application/constants";
import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// Login no-session race: client sign-in resolves once the auth response (incl.
// Set-Cookie) is in hand, but the next server render occasionally can't see the
// session yet and `requireAuth()` bounces to `/login?bounced=no-session` (61% of
// server bounces in `login_server_bounce`'s first month). No backend read replica
// or session cache, so one confirming read that succeeds proves the next server
// render resolves too. The per-read timeout bounds the loop — better-auth's fetch
// has no default timeout, so a stalled read would otherwise pin the spinner and
// strand the DJ. Worst case ~5 × (timeout + delay).
const SESSION_CONFIRM_ATTEMPTS = 5;
const SESSION_CONFIRM_DELAY_MS = 150;
const SESSION_CONFIRM_TIMEOUT_MS = 2000;

/**
 * Poll better-auth until it acknowledges the current session, forcing a fresh
 * server read each time (`disableCookieCache`). Resolves `true` once a user is
 * seen or `false` when attempts are exhausted — the caller navigates either way,
 * so a persistent failure never strands the DJ on the login screen.
 */
async function confirmSessionVisible(): Promise<boolean> {
  for (let attempt = 1; attempt <= SESSION_CONFIRM_ATTEMPTS; attempt++) {
    // `.catch` sits on the read, not the race: a read the timeout already beat
    // must resolve to null here, not surface as an unhandled rejection. A
    // transient failure and an empty session both mean "not yet visible" — retry.
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
 * Waits for `confirmSessionVisible` before navigating, closing the no-session
 * race where a client "login successful" is undone by a server `requireAuth()`
 * bounce. Emits one `login_post_redirect` with a `destination` discriminator; the
 * RAW onboarding flag (incl. null) keeps an undefined-flag misroute distinct from
 * a genuinely-incomplete account (#836 Bug B), and `session_confirmed` keeps a
 * residual race visible in telemetry.
 *
 * On a failed confirm gate for a dashboard-bound login we `refresh()` rather than
 * `push()` into a known bounce: pushing would hit `/login?bounced=no-session` and
 * trip the `SessionEndedNotice` toast, contradicting the "Login successful" just
 * shown. A refresh lets the `/login` layout arbitrate — forward if the session
 * became visible, re-show the form if not. Never strands the DJ.
 */
async function redirectAfterAuth(
  router: { push: (href: string) => void; refresh: () => void },
  user: { id?: string; hasCompletedOnboarding?: boolean } | undefined,
  method: LoginMethod,
  oidcParams?: URLSearchParams | ReadonlyURLSearchParams,
): Promise<void> {
  const dashboardHome = String(
    process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || DEFAULT_DASHBOARD_HOME_PAGE,
  );
  // "incomplete" = we affirmatively know onboarding isn't done: a present user
  // whose flag is false or absent (#836 Bug B). An absent user OBJECT is unknown,
  // not incomplete — the post-auth read failed (e.g. QR getSession hiccup), so
  // defer to server requireAuth rather than force onboarding on a DJ who just
  // authenticated (#849).
  const incomplete = !!user && user.hasCompletedOnboarding !== true;
  // Resolve a live OIDC authorize bounce (`client_id` + `response_type=code`) to
  // its resume target, or null. Computed here so every credential entry point
  // shares one definition of a bounce and its resume (#836).
  const oidcTarget = oidcParams
    ? getOidcRedirectTarget(oidcParams, authBaseURL)
    : null;

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
    // Full document navigation to the authorize endpoint. In prod `authBaseURL`
    // is the same-origin `/auth` proxy (a next.config rewrite, not an app route),
    // so `router.push` would soft-navigate and fire a background RSC fetch to
    // `/oauth2/authorize`, burning the one-time OIDC code before the user leaves.
    // `window.location.assign` leaves the SPA cleanly, so `refresh()` is moot.
    window.location.assign(oidcTarget);
    return;
  }

  if (incomplete) {
    // Preserve a live authorize bounce verbatim across the onboarding detour
    // (#836 Bug A) so useNewUser can resume the round-trip on completion. The
    // onboarding form renders off session state, so the non-load-bearing
    // `incomplete=true` marker is only needed when there are no real params to
    // keep. An absent-flag user with a live bounce lands here too — routed to
    // onboarding, not delegated a code (#836 Bug B).
    router.push(oidcTarget ? `/login?${oidcParams!.toString()}` : "/login?incomplete=true");
  } else {
    router.push(dashboardHome);
  }
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

      const signInUser = (result as { data?: { user?: { id?: string; hasCompletedOnboarding?: boolean } } }).data?.user;
      let user = signInUser;
      if (signInUser?.hasCompletedOnboarding !== true) {
        const session = await authClient.getSession();
        if (session.data?.user) {
          user = { ...signInUser, ...session.data.user };
        }
      }
      // If we got here as part of an OIDC authorize bounce, redirectAfterAuth
      // resumes the round-trip from these params (handing off to
      // `${authBase}/oauth2/authorize?<original-query>` on completion, or
      // preserving them across the onboarding detour). See `getOidcRedirectTarget`.
      await redirectAfterAuth(router, user, "password", searchParams ?? undefined);
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

      const signInUser = (result as { data?: { user?: { id?: string; hasCompletedOnboarding?: boolean } } }).data?.user;
      let user = signInUser;
      if (signInUser?.hasCompletedOnboarding !== true) {
        const session = await authClient.getSession();
        if (session.data?.user) {
          user = { ...signInUser, ...session.data.user };
        }
      }
      // Mirror useLogin's OIDC resume contract — both credential entry
      // points feed the same authorize round-trip.
      await redirectAfterAuth(router, user, "otp", searchParams ?? undefined);
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
      // Drop the departing session's cached org-role so it can't be served to the
      // next user on this shared control-room browser.
      clearSessionAuthData();
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

// Single owner for the per-session org-role resolution. `authClient.useSession()`
// is better-auth's shared reactive store, but the async role lookup it feeds
// (`betterAuthSessionToAuthenticationDataAsync` → jwtDecode + org `listMembers`
// fallback) was re-run by every mounted consumer: N guards/registry/catalog hooks
// meant N resolutions per session. A single-slot cache keyed by session identity,
// with in-flight dedupe, collapses that to one — consumers converge on one cached
// `AuthenticationData` reference. The effect below keeps the #612 cancellation
// contract unchanged; committing only while this key is still the newest request
// means a stale session's late resolution can never win the slot.
let cachedAuthKey: string | null = null;
let cachedAuthData: AuthenticationData | null = null;
let inflightAuthKey: string | null = null;
let inflightAuthData: Promise<AuthenticationData> | null = null;

function resolveSessionAuthData(session: unknown): Promise<AuthenticationData> {
  let key: string | null;
  try {
    key = JSON.stringify(session);
  } catch {
    // Unserializable session (should not happen): resolve directly, un-deduped,
    // so behavior is never worse than the per-mount baseline.
    return betterAuthSessionToAuthenticationDataAsync(session as any);
  }
  if (cachedAuthKey === key && cachedAuthData) return Promise.resolve(cachedAuthData);
  if (inflightAuthKey === key && inflightAuthData) return inflightAuthData;

  const promise = betterAuthSessionToAuthenticationDataAsync(session as any)
    .then((data) => {
      if (inflightAuthKey === key) {
        cachedAuthKey = key;
        cachedAuthData = data;
        inflightAuthKey = null;
        inflightAuthData = null;
      }
      return data;
    })
    .catch((error) => {
      if (inflightAuthKey === key) {
        inflightAuthKey = null;
        inflightAuthData = null;
      }
      throw error;
    });
  inflightAuthKey = key;
  inflightAuthData = promise;
  return promise;
}

// Drop the cached org-role resolution and any in-flight slot. Called on logout so
// the dedupe never outlives the session that seeded it.
function clearSessionAuthData(): void {
  cachedAuthKey = null;
  cachedAuthData = null;
  inflightAuthKey = null;
  inflightAuthData = null;
}

export const useAuthentication = () => {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [authData, setAuthData] = useState<AuthenticationData>(
    session
      ? betterAuthSessionToAuthenticationData(session as any)
      : { message: "Not Authenticated" }
  );
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  useEffect(() => {
    // Guard against a stale session's role fetch resolving after a newer one: on
    // a session transition (logout→login, refresh, OTP) the older promise could
    // otherwise clobber authData with the previous session's role, or resolve
    // after unmount — #612.
    let cancelled = false;
    if (session && !isPending) {
      setIsLoadingRole(true);
      resolveSessionAuthData(session)
        .then((data) => {
          if (!cancelled) setAuthData(data);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Failed to fetch organization role, using session data:", error);
          setAuthData(betterAuthSessionToAuthenticationData(session as any));
        })
        .finally(() => {
          if (!cancelled) setIsLoadingRole(false);
        });
    } else if (!session) {
      setAuthData({ message: "Not Authenticated" });
      // If the session ended while a role fetch was in flight, that fetch's
      // finally is now cancelled-gated and can no longer reset the flag —
      // settle it here or `authenticating` sticks true forever (#612).
      setIsLoadingRole(false);
    }
    return () => {
      cancelled = true;
    };
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

  const user = isAuthenticated(data) ? data.user : null;
  const id = user?.id;
  const realName = user?.realName;
  const djName = user?.djName;

  // Stable `info` identity across renders when content is unchanged: consumers
  // feed it into useCallback/effect dep arrays across flowsheet/bin/dj hooks, so
  // a fresh object each render would cascade recomputation (census §3).
  const info = useMemo(
    () => (id ? { id, real_name: realName || undefined, dj_name: djName || undefined } : null),
    [id, realName, djName],
  );

  return {
    loading: authenticating || !authenticated,
    info,
  };
};

/**
 * Onboarding completion.
 *
 * - `"invite"` (OnboardingForm at /onboarding?token=…): sends the setup token
 *   and chosen password to complete-onboarding, then signs in through the
 *   regular authClient path — the same one normal login uses.
 * - `"session"` (NewUserForm at /login?incomplete=true): the user is already
 *   signed in, so only profile fields are sent; no token, no password change.
 */
export const useNewUser = (mode: "invite" | "session") => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const { execute, isLoading, error } = useAsyncAction();

  const handleNewUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return execute(async () => {
      const realNameValue = e.currentTarget.realName?.value?.trim() || "";
      const djNameValue = e.currentTarget.djName?.value?.trim() || "";
      const password: string =
        mode === "invite" ? e.currentTarget.password.value : "";

      const body: Record<string, string> = {};
      if (realNameValue) {
        body.realName = realNameValue;
      }
      if (djNameValue) {
        body.djName = djNameValue;
      }

      if (mode === "invite") {
        const setupToken = searchParams?.get("token")?.trim();
        if (!setupToken) {
          throw new Error(
            "Your setup link is invalid or expired. Ask your station manager to resend the invite."
          );
        }
        if (!password) {
          throw new Error("Please choose a password");
        }
        body.token = setupToken;
        body.newPassword = password;
      }

      const response = await completeOnboarding(body);

      clearTokenCache();

      if (mode === "invite") {
        const signInResult = await authClient.signIn.email({
          email: response.email ?? "",
          password,
        });
        if (signInResult.error) {
          toast.success("Account setup complete. Please sign in with your new password.");
          router.push("/login");
          return;
        }
      }

      toast.success("Account setup complete. Welcome!");
      // Resume a live OIDC authorize round-trip that was preserved in the
      // /login URL across the onboarding detour (#836). For the invite flow the
      // URL carries only the setup `token` (no authorize params), so this is a
      // no-op and the DJ lands on the dashboard as before.
      await redirectAfterAuth(
        router,
        { id: response.userId, hasCompletedOnboarding: true },
        "onboarding",
        searchParams ?? undefined,
      );
    }, "Failed to complete onboarding. Please try again.");
  };

  useEffect(() => {
    dispatch(authenticationSlice.actions.reset());
  }, []);

  // Replace (not append to) the required list: the slice default includes
  // username/password for the login form, which these forms don't render.
  const addRequiredCredentials = (required: (keyof VerifiedData)[]) =>
    dispatch(authenticationSlice.actions.setRequiredCredentials(required));

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
