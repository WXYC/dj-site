import { useListAccountsQuery } from "@/lib/features/admin/api";
import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useMemo, useCallback, useState } from "react";
import { createAuthenticatedHooks } from "./createAuthenticatedHooks";
import { toast } from "sonner";

const _useAccountListResults = () => {
  const { data, isError, isLoading, error } = useListAccountsQuery(undefined);

  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  const filteredData = useMemo(() => {
    if (searchString.length > 0) {
      return (
        data?.filter(
          (account) =>
            account.userName
              .toLowerCase()
              .includes(searchString.toLowerCase()) ||
            account.realName
              .toLowerCase()
              .includes(searchString.toLowerCase()) ||
            account.djName.toLowerCase().includes(searchString.toLowerCase())
        ) ?? []
      );
    }
    return data ?? [];
  }, [data, searchString]);

  return {
    data: filteredData,
    isLoading,
    isError,
    error,
  };
};

export const useAccountListResults = createAuthenticatedHooks(_useAccountListResults);

// Hook for creating new user accounts with better-auth
const _useCreateUserAccount = () => {
  const [creating, setCreating] = useState(false);

  const createUserAccount = useCallback(async (userData: {
    email: string;
    username: string;
    realName: string;
    djName?: string;
    role?: "member" | "dj" | "music-director" | "admin";
  }) => {
    setCreating(true);
    
    try {
      const response = await fetch("/api/auth/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to create user account");
        return { success: false, error: result.error };
      }

      toast.success(`Account created for ${userData.realName}. Onboarding link generated.`);
      
       // In production, you would send the onboarding email here
       // For now, we'll show the token in a toast (remove this in production)
       if (result.onboardingToken) {
         const onboardingUrl = `${window.location.origin}/onboarding?token=${result.onboardingToken}`;
         console.log("Onboarding URL:", onboardingUrl);
         toast.info("Onboarding URL logged to console (send this to the user)");
       }

      return { success: true, user: result.user, onboardingToken: result.onboardingToken };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create account: ${errorMessage}`);
      console.error("[CreateUser] Error:", error);
      return { success: false, error: errorMessage };
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    createUserAccount,
    creating,
  };
};

export const useCreateUserAccount = createAuthenticatedHooks(_useCreateUserAccount);
