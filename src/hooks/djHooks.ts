"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { AccountModification } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { createAuthenticatedHooks } from "./createAuthenticatedHooks";

const _useDJAccount = () => {
  const router = useRouter();
  const { info, loading } = useRegistry();

  const modifications = useAppSelector(
    authenticationSlice.selectors.getModifications
  );

  const dispatch = useAppDispatch();

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
        // TODO: Implement user data update when API is available
        toast.info("User settings update functionality coming soon");
        console.log("User data to update:", data);
      }
    },
    [modifications, info]
  );

  return {
    info,
    loading,
    handleSaveData,
  };
};

export const useDJAccount = createAuthenticatedHooks(_useDJAccount);
