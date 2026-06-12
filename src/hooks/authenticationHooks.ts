"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authBaseURL, authClient, clearTokenCache, lookupEmailByIdentifier } from "@/lib/features/authentication/client";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { resetApplication } from "./applicationHooks";
import { throwIfBetterAuthError } from "@/src/utilities/throwIfBetterAuthError";
import { getOidcRedirectTarget } from "@/src/utilities/oidcRedirectTarget";
import { useAsyncAction } from "./useAsyncAction";

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

      const dashboardHome = String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");
      toast.success("Login successful");

      const user = (result as any).data?.user;
      if (user && user.hasCompletedOnboarding === false) {
        router.push("/login?incomplete=true");
      } else {
        // If we got here as part of an OIDC authorize bounce, resume the round-trip
        // by sending the user back to `${authBase}/oauth2/authorize?<original-query>`
        // instead of the dashboard. See `getOidcRedirectTarget` for the contract.
        const oidcTarget = getOidcRedirectTarget(
          new URLSearchParams(searchParams?.toString() ?? ""),
          authBaseURL
        );
        router.push(oidcTarget ?? dashboardHome);
      }
      router.refresh();
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
      const dashboardHome = String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");

      const user = (result as any).data?.user;
      if (user && user.hasCompletedOnboarding === false) {
        router.push("/login?incomplete=true");
      } else {
        // Mirror useLogin's OIDC resume contract — both credential entry
        // points feed the same authorize round-trip.
        const oidcTarget = getOidcRedirectTarget(
          new URLSearchParams(searchParams?.toString() ?? ""),
          authBaseURL
        );
        router.push(oidcTarget ?? dashboardHome);
      }
      router.refresh();
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
      router.refresh();
      resetApplication(dispatch);
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

      const dashboardHome = String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");
      toast.success("Profile updated successfully");
      router.push(dashboardHome);
      router.refresh();
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
