import {
  useAddToBinMutation,
  useClearBinMutation,
  useDeleteFromBinMutation,
  useGetBinQuery,
} from "@/lib/features/bin/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { useAppSelector } from "@/lib/hooks";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { filterBySearchTerms } from "@/src/utilities/filterBySearchTerms";

export const useBin = () => {
  const { loading, info } = useRegistry();

  const { data, isLoading, isSuccess, isError } = useGetBinQuery(
    {
      dj_id: info?.id!,
    },
    {
      skip: !info || loading,
    }
  );

  return {
    bin: data,
    loading: isLoading || loading,
    isSuccess,
    isError,
  };
};

function useBinMutation(
  useMutation: typeof useAddToBinMutation | typeof useDeleteFromBinMutation,
  errorMessage: string,
) {
  const { loading, info } = useRegistry();
  const [mutate, result] = useMutation();

  const action = useCallback(
    (album_id: number) => {
      if (loading || !info) return;
      mutate({ dj_id: info?.id!, album_id });
    },
    [info, loading, mutate]
  );

  useEffect(() => {
    if (result.isError) {
      toast.error(errorMessage);
    }
  }, [result, errorMessage]);

  return { action, loading: result.isLoading || loading };
}

export const useDeleteFromBin = () => {
  const { action, loading } = useBinMutation(useDeleteFromBinMutation, "Failed to remove album from bin");
  return { deleteFromBin: action, loading };
};

export const useAddToBin = () => {
  const { action, loading } = useBinMutation(useAddToBinMutation, "Failed to add album to bin");
  return { addToBin: action, loading };
};

export const BIN_CLEAR_CONFIRM_THRESHOLD = 4;

export const useClearMailBin = () => {
  const { loading: registryLoading, info } = useRegistry();
  const { bin, loading: binLoading } = useBin();
  const [clearBin, { isLoading: clearing }] = useClearBinMutation();

  const count = bin?.length ?? 0;
  const isEmpty = count === 0;

  const runClear = useCallback(async () => {
    if (!info || isEmpty || clearing) return;

    try {
      await clearBin({ dj_id: info.id }).unwrap();
      toast.success(
        count === 1
          ? "Removed 1 item from your mail bin."
          : `Removed ${count} items from your mail bin.`,
      );
    } catch {
      toast.error("Failed to clear mail bin.");
    }
  }, [clearBin, clearing, count, info, isEmpty]);

  const requestClear = useCallback(() => {
    if (!info || isEmpty || clearing || registryLoading || binLoading) return;

    if (count > BIN_CLEAR_CONFIRM_THRESHOLD) {
      toast.warning(`Remove all ${count} items from your mail bin?`, {
        action: {
          label: "Clear bin",
          onClick: () => {
            void runClear();
          },
        },
        cancel: {
          label: "Cancel",
        },
        duration: 10_000,
      });
      return;
    }

    void runClear();
  }, [
    binLoading,
    clearing,
    count,
    info,
    isEmpty,
    registryLoading,
    runClear,
  ]);

  return {
    requestClear,
    /** Mutation in flight only — not registry/bin query loading (avoids SSR hydration class mismatch on Joy Button). */
    clearing,
    disabled: isEmpty || binLoading || registryLoading || clearing,
  };
};

export const useBinResults = () => {
  const { bin, loading, isSuccess } = useBin();
  const flowsheetQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  const searchResults = useMemo(() => {
    if (!bin || loading || !isSuccess) {
      return [];
    }
    return filterBySearchTerms(bin, flowsheetQuery);
  }, [bin, loading, isSuccess, flowsheetQuery]);

  return {
    searchResults,
  };
};
