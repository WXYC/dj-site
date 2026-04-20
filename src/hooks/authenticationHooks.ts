"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authClient } from "@/lib/features/authentication/client";
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

export const useLogin = () => {
  const router = useRouter();
  const { execute, isLoading, error } = useAsyncAction();

  const verified = useAppSelector(
    authenticationSlice.selectors.allCredentialsVerified
  );

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return execute(async () => {
      const username = e.currentTarget.username.value;
      const password = e.currentTarget.password.value;

      const result = (await authClient.signIn.username({
        username,
        password,
      })) as { error?: unknown };

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
      if (user && !user.realName) {
        router.push("/login?incomplete=true");
      } else {
        router.push(dashboardHome);
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

  const handleSendOTP = async (email: string) => {
    const success = await execute(async () => {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });

      throwIfBetterAuthError(result as any, "Failed to send login code");

      toast.success("Login code sent! Check your email.");
    }, "Failed to send login code. Please try again.");

    if (!success) {
      throw new Error(error?.message || "Failed to send login code");
    }
  };

  return { handleSendOTP, isLoading, error };
};

export const useOTPVerify = () => {
  const router = useRouter();
  const { execute, isLoading, error } = useAsyncAction();

  const handleVerifyOTP = (email: string, otp: string) =>
    execute(async () => {
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
      if (user && !user.realName) {
        router.push("/login?incomplete=true");
      } else {
        router.push(dashboardHome);
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

      const updateRequest: any = {};
      if (params.realName) {
        updateRequest.realName = params.realName;
      }
      if (params.djName) {
        updateRequest.djName = params.djName;
      }
      const result = await authClient.updateUser(updateRequest);

      throwIfBetterAuthError(result, "Failed to update user profile");

      if (params.password) {
        const passwordResult = await authClient.changePassword({
          currentPassword,
          newPassword: params.password,
        });

        throwIfBetterAuthError(passwordResult, "Failed to update password");
      }

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
