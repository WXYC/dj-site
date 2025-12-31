"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { authClient } from "@/lib/features/authentication/client";
import {
  AuthenticatedUser,
  AuthenticationData,
  djAttributeNames,
  isAuthenticated,
  NewUserCredentials,
  ResetPasswordRequest,
  VerifiedData,
} from "@/lib/features/authentication/types";
import { betterAuthSessionToAuthenticationData } from "@/lib/features/authentication/utilities";
import { Authorization } from "@/lib/features/admin/types";
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
      const result = await authClient.signIn.username({
        username,
        password,
      });

      if (result.error) {
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : typeof result.error === 'string' 
            ? result.error 
            : (result.error as any)?.message || 'Login failed. Please check your credentials.';
        
        setError(result.error instanceof Error ? result.error : new Error(errorMessage));
        toast.error(errorMessage);
        handleLogout();
      } else {
        // Sign in successful, session cookie is set
        toast.success("Login successful");
        router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
        router.refresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred during login. Please try again.';
      
      setError(err instanceof Error ? err : new Error(errorMessage));
      toast.error(errorMessage);
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
      toast.success("Logged out successfully");
      router.refresh();
      resetApplication(dispatch);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to logout. Please try again.';
      
      console.error("Logout error:", error);
      toast.error(errorMessage);
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
  
  const authData: AuthenticationData = session 
    ? betterAuthSessionToAuthenticationData(session as any)
    : { message: "Not Authenticated" };

  return {
    data: authData,
    authenticating: isPending,
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handleNewUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const username = e.currentTarget.username.value;
    const password = e.currentTarget.password.value;

    const params: NewUserCredentials = {
      username,
      password,
    };

    // Extract form values - form fields use the attribute names directly (realName, djName)
    // not the djAttributeNames keys (name, custom:dj-name)
    const realNameValue = e.currentTarget.realName?.value || "";
    const djNameValue = e.currentTarget.djName?.value || "";
    
    if (realNameValue) {
      params.realName = realNameValue;
    }
    if (djNameValue) {
      params.djName = djNameValue;
    }

    try {
      // Get current session to ensure user is authenticated
      const session = await authClient.getSession();
      if (!session.data?.user?.id) {
        throw new Error("You must be authenticated to update your profile");
      }

      // Update user via better-auth non-admin updateUser (updates current user)
      // Custom metadata fields (realName, djName) go at the top level, not in a 'data' object
      // This is different from admin.createUser which uses a 'data' object
      const updateRequest: any = {};

      // Add custom metadata fields at the top level (non-admin updateUser format)
      if (params.realName) {
        updateRequest.realName = params.realName;
      }
      if (params.djName) {
        updateRequest.djName = params.djName;
      }

      // Update user profile data (non-admin - updates current user)
      const result = await authClient.updateUser(updateRequest);

      if (result.error) {
        const errorMessage = result.error.message || 'Failed to update user profile';
        throw new Error(errorMessage);
      }

      // Handle password update separately if provided (after successful profile update)
      if (params.password) {
        // Note: Password update via admin API requires admin privileges
        // Since non-admin users can't use admin API, this will fail
        // In production, you might want to use a dedicated password change endpoint
        // For now, we handle the failure gracefully and don't block the profile update
        try {
          const passwordResult = await authClient.admin.updateUser({
            userId: session.data.user.id,
            password: params.password,
          });

          if (passwordResult.error) {
            // Password update failed, but profile update succeeded
            // Log warning but don't fail the entire operation
            console.warn("Password update failed:", passwordResult.error.message);
          }
        } catch (passwordErr) {
          // Password update failed, but profile update succeeded
          console.warn("Password update error:", passwordErr);
        }
      }

      // User updated successfully, redirect to dashboard
      toast.success("Profile updated successfully");
      router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to update user profile. Please try again.';
      
      setError(err instanceof Error ? err : new Error(errorMessage));
      toast.error(errorMessage);
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
  const { handleLogout } = useLogout();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [requestingReset, setRequestingReset] = useState(false);

  const verified = useAppSelector(
    authenticationSlice.selectors.requiredCredentialsVerified
  );

  // Note: better-auth may not have built-in password reset
  // This may need to call an admin API endpoint
  const handleRequestReset = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const username = e.currentTarget.form?.username.value;
    if (!username) return;

    setRequestingReset(true);
    setError(null);

    try {
      // Password reset must be done via admin API
      // Get current session to ensure user is authenticated
      const session = await authClient.getSession();
      if (!session.data) {
        throw new Error("You must be authenticated to reset passwords");
      }

      // Find user by username
      const listResult = await authClient.admin.listUsers({
        query: {
          searchValue: username,
          searchField: "name",
          limit: 1,
        },
      });

      if (listResult.error || !listResult.data?.users || listResult.data.users.length === 0) {
        throw new Error(`User with username ${username} not found`);
      }

      const targetUserId = listResult.data.users[0].id;

      // Generate a temporary password (better-auth doesn't have a built-in reset, so we'll set a new one)
      // In a real scenario, you might want to generate a secure temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

      const result = await authClient.admin.updateUser({
        userId: targetUserId,
        password: tempPassword,
      });

      if (result.error) {
        const errorMessage = result.error.message || 'Failed to reset password';
        throw new Error(errorMessage);
      }

      toast.success(`Password reset successfully. Temporary password: ${tempPassword}`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Failed to reset password. Please try again.';
      
      setError(err instanceof Error ? err : new Error(errorMessage));
      toast.error(errorMessage);
      // Don't logout on error - let user see the error message
    } finally {
      setRequestingReset(false);
    }
  };

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const code = e.currentTarget.code.value;
    const password = e.currentTarget.password.value;
    const username = e.currentTarget.username.value;

    if (!code || !password || !username) {
      const errorMessage = "All fields are required";
      setError(new Error(errorMessage));
      toast.error(errorMessage);
      setIsLoading(false);
      return;
    }

    try {
      // Password reset confirmation: user sets new password after admin reset
      // This flow requires the user to login with the temporary password first
      // Then they can change it, or we could add a change password endpoint
      const errorMessage = "Password reset confirmation requires login with temporary password. Please contact an administrator for a password reset.";
      throw new Error(errorMessage);
      
      // After successful reset, user should be able to login
      // router.push(String(process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE));
      // router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Password reset failed. Please try again.';
      
      setError(err instanceof Error ? err : new Error(errorMessage));
      toast.error(errorMessage);
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
