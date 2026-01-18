"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { AccountModification } from "@/lib/features/authentication/types";
import { authClient } from "@/lib/features/authentication/client";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";

export function useDJAccount() {
  const router = useRouter();
  const { info, loading } = useRegistry();

  const modifications = useAppSelector(
    authenticationSlice.selectors.getModifications
  );

  const dispatch = useAppDispatch();

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isUpdating) {
      dispatch(authenticationSlice.actions.resetModifications());
    }
  }, [isUpdating, dispatch]);

  const handleSaveData = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (info === undefined || info === null) return;

      setIsUpdating(true);
      setUpdateError(null);

      try {
        const formData = new FormData(e.currentTarget);

        let data: AccountModification = {};

        for (const [key, value] of formData.entries()) {
          if (value !== "" && modifications.some((name) => name == key)) {
            data[key as keyof AccountModification] = value as string;
          }
        }

        if (Object.keys(data).length > 0) {
          // Get current session to ensure user is authenticated
          const session = await authClient.getSession();
          if (!session.data?.user?.id) {
            throw new Error("User not authenticated");
          }

          // Update user via better-auth non-admin updateUser (updates current user)
          // Custom metadata fields (realName, djName) go at the top level
          // Email updates may require special handling in better-auth
          const updateData: Record<string, any> = {};
          if (data.realName) updateData.realName = data.realName;
          if (data.djName) updateData.djName = data.djName;
          // Note: Email updates via non-admin updateUser may have restrictions
          // If email update fails, user may need admin assistance
          if (data.email) updateData.email = data.email;

          if (Object.keys(updateData).length > 0) {
            // Use non-admin updateUser (same pattern as onboarding fix)
            const result = await authClient.updateUser(updateData);

            if (result.error) {
              throw new Error(result.error.message || "Failed to update user");
            }

            // Update successful
            toast.success("User settings saved.");
            router.refresh();
          }
        }
      } catch (err) {
        setUpdateError(err instanceof Error ? err : new Error(String(err)));
        const message = err instanceof Error ? err.message : "Failed to update user settings";
        if (message.trim().length > 0) {
          toast.error(message);
        }
      } finally {
        setIsUpdating(false);
      }
    },
    [modifications]
  );

  return {
    info,
    loading: loading || isUpdating,
    handleSaveData,
  };
}
