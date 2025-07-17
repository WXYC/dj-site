"use client";

import {
  useModDJInfoMutation,
  useModifyUserMutation,
} from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { AccountModification, BackendAccountModification } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";

export function useDJAccount() {
  const router = useRouter();
  const { info, loading } = useRegistry();

  const modifications = useAppSelector(
    authenticationSlice.selectors.getModifications
  );

  const dispatch = useAppDispatch();

  const [updateUserData, result] = useModifyUserMutation();
  const [reflectBackendUpdate, backendResult] = useModDJInfoMutation();

  useEffect(() => {
    if (!result.isLoading && !backendResult.isLoading) {
      dispatch(authenticationSlice.actions.resetModifications());
    }

    if (result.isSuccess) {
      toast.success("User settings saved.");
      router.refresh();
    }
  }, [result, backendResult, dispatch, router]);

  const handleSaveData = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (info === undefined || info === null) return;

      const formData = new FormData(e.currentTarget);

      let data: AccountModification = {};

      for (const [key, value] of formData.entries()) {
        if (value !== "" && modifications.some((name) => name == key)) {
          data[key as keyof AccountModification] = value as string;
        }
      }

      if (Object.keys(data).length > 0) {
        updateUserData(data);

        const backendData: BackendAccountModification = {
          cognito_user_name: info.cognito_user_name,
          real_name: data.realName || info.real_name,
          dj_name: data.djName || info.dj_name,
        }

        reflectBackendUpdate(backendData);
      }
    },
    [modifications]
  );

  return {
    info,
    loading: loading || result.isLoading || backendResult.isLoading,
    handleSaveData,
  };
}
