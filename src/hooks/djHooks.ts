"use client";

import {
  useModDJInfoMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { AccountModification, BackendAccountModification } from "@/lib/features/authentication/types";
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

  const [reflectBackendUpdate, backendResult] = useModDJInfoMutation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isUpdating && !backendResult.isLoading) {
      dispatch(authenticationSlice.actions.resetModifications());
    }

    if (!isUpdating && !updateError && backendResult.isSuccess) {
      toast.success("User settings saved.");
      router.refresh();
    }
  }, [isUpdating, backendResult, dispatch, router, updateError]);

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
          // Get current session to get user ID
          const session = await authClient.getSession();
          if (!session.data?.user?.id) {
            throw new Error("User not authenticated");
          }

          // Update user via better-auth admin API
          // Note: This requires admin privileges, or we need a user update endpoint
          // For now, using admin API - in production, you might want a dedicated user update endpoint
          const updateData: Record<string, any> = {};
          if (data.realName) updateData.realName = data.realName;
          if (data.djName) updateData.djName = data.djName;
          if (data.email) updateData.email = data.email;

          if (Object.keys(updateData).length > 0) {
            const result = await authClient.admin.updateUser({
              userId: session.data.user.id,
              ...updateData,
            });

            if (result.error) {
              throw new Error(result.error.message || "Failed to update user");
            }
          }

          const backendData: BackendAccountModification = {
            cognito_user_name: info.cognito_user_name,
            real_name: data.realName || info.real_name,
            dj_name: data.djName || info.dj_name,
          };

          await reflectBackendUpdate(backendData);
        }
      } catch (err) {
        setUpdateError(err instanceof Error ? err : new Error(String(err)));
        toast.error(err instanceof Error ? err.message : "Failed to update user settings");
      } finally {
        setIsUpdating(false);
      }
    },
    [modifications, info, reflectBackendUpdate]
  );

  return {
    info,
    loading: loading || isUpdating || backendResult.isLoading,
    handleSaveData,
  };
}
