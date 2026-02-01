"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authClient } from "@/lib/features/authentication/client";
import {
  AuthenticationData,
  isAuthenticated,
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

export const useLogin = () => {
  const router = useRouter();

  const verified = useAppSelector(
    authenticationSlice.selectors.allCredentialsVerified
  );

  const { handleLogout } = useLogout();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const username = e.currentTarget.username.value;
    const password = e.currentTarget.password.value;

    try {
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

        setError(result.error instanceof Error ? result.error : new Error(errorMessage));
        if (errorMessage.trim().length > 0) {
          toast.error(errorMessage);
        }
        handleLogout();
      } else {
        // Sign in successful, session cookie is set
        // Check if user profile is incomplete (needs onboarding)
        const session = await authClient.getSession();
        const user = session?.data?.user;

        // Check if user profile is incomplete (missing or empty realName/djName)
        // Cast to include custom user fields (realName, djName are custom schema fields)
        const userWithCustomFields = user as typeof user & { realName?: string | null; djName?: string | null };
        const isIncomplete = userWithCustomFields && (
          !userWithCustomFields.realName ||
          (typeof userWithCustomFields.realName === 'string' && userWithCustomFields.realName.trim() === '') ||
          !userWithCustomFields.djName ||
          (typeof userWithCustomFields.djName === 'string' && userWithCustomFields.djName.trim() === '')
        );

        if (isIncomplete) {
          // User is incomplete, redirect to onboarding
          toast.success("Please complete your profile");
          router.push("/onboarding");
          router.refresh();
        } else {
          // User profile is complete, go to dashboard
          const dashboardHome = String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog");
          toast.success("Login successful");
          router.push(dashboardHome);
          router.refresh();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred during login. Please try again.';
      
      setError(err instanceof Error ? err : new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
      handleLogout();
    } finally {
      setIsLoading(false);
    }
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

export const useLogout = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsLoading(true);

    try {
      await authClient.signOut();
      router.refresh();
      resetApplication(dispatch);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to logout. Please try again.';
      
      console.error("Logout error:", error);
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleNewUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Extract form values - only collect profile fields
    // Password is already set via the email link before the user reaches onboarding
    const realNameValue = e.currentTarget.realName?.value || "";
    const djNameValue = e.currentTarget.djName?.value || "";

    try {
      // Get current session to ensure user is authenticated
      const session = await authClient.getSession();
      if (!session.data?.user?.id) {
        throw new Error("You must be authenticated to update your profile");
      }

      // Update user via better-auth non-admin updateUser (updates current user)
      // Custom metadata fields (realName, djName) go at the top level, not in a 'data' object
      const updateRequest: Record<string, string> = {};

      if (realNameValue) {
        updateRequest.realName = realNameValue;
      }
      if (djNameValue) {
        updateRequest.djName = djNameValue;
      }

      // Update user profile data (non-admin - updates current user)
      const result = await authClient.updateUser(updateRequest);

      if (result.error) {
        const errorMessage = result.error.message || "Failed to update user profile";
        throw new Error(errorMessage);
      }

      // No password change needed - user already set it via email link

      // User updated successfully, redirect to dashboard
      const dashboardHome = String(
        process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE || "/dashboard/catalog"
      );
      toast.success("Profile updated successfully");
      router.push(dashboardHome);
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update user profile. Please try again.";

      setError(err instanceof Error ? err : new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
      // Don't logout on error - let user see the error message
    } finally {
      setIsLoading(false);
    }
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requestingReset, setRequestingReset] = useState(false);

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  const handleRequestReset = async (email: string) => {
    if (!email) {
      const errorMessage = "Please enter your email address";
      setError(new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
      return;
    }

    setRequestingReset(true);
    setError(null);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;

      const result = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });

      if (result.error) {
        const errorMessage = result.error.message || "Failed to request password reset";
        throw new Error(errorMessage);
      }

      toast.success(result.data?.message || "If this email exists, check for a reset link.");
      dispatch(applicationSlice.actions.setAuthStage("login"));
      router.push("/login");
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : "Failed to request password reset. Please try again.";

      setError(err instanceof Error ? err : new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
    } finally {
      setRequestingReset(false);
    }
  };

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const token = e.currentTarget.token?.value;
    const password = e.currentTarget.password.value;

    if (!token || !password) {
      const errorMessage = "All fields are required";
      setError(new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
      setIsLoading(false);
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        const errorMessage = result.error.message || "Password reset failed";
        throw new Error(errorMessage);
      }

      toast.success("Password reset successfully. Please log in.");
      dispatch(applicationSlice.actions.setAuthStage("login"));
      router.push("/login");
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : "Password reset failed. Please try again.";

      setError(err instanceof Error ? err : new Error(errorMessage));
      if (errorMessage.trim().length > 0) {
        toast.error(errorMessage);
      }
      // Don't logout on error - let user see the error message
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleReset,
    handleRequestReset,
    verified,
    requestingReset,
    error,
  };
};
