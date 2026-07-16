import {
  useAddToBinMutation,
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

/**
 * Bulk-clears the bin by firing a delete for every current entry. There is no
 * bulk endpoint on the backend yet, so this loops the single-item mutation;
 * RTK Query coalesces the resulting `["Bin"]` invalidations into one refetch.
 */
export const useClearBin = () => {
  const { loading: registryLoading, info } = useRegistry();
  const { bin } = useBin();
  const [deleteFromBin] = useDeleteFromBinMutation();
  // Aggregate in-flight state tracked locally: the mutation hook's own
  // `isLoading` only reflects the most recently dispatched request, so with
  // N parallel deletes it flips false as soon as the last-dispatched one
  // settles, not when they've all settled.
  const [pending, setPending] = useState(false);

  const clearBin = useCallback(async () => {
    if (registryLoading || !info || !bin || bin.length === 0) return;
    setPending(true);
    try {
      const outcomes = await Promise.allSettled(
        bin.map((entry) =>
          deleteFromBin({ dj_id: info.id!, album_id: entry.id }).unwrap()
        )
      );
      // Name what survived so the DJ knows which albums to retry — the
      // rows also stay visible in the bin after the refetch.
      const failedTitles = bin
        .filter((_, i) => outcomes[i].status === "rejected")
        .map((entry) => entry.title);
      if (failedTitles.length > 0) {
        const shown = failedTitles.slice(0, 3).join(", ");
        const more =
          failedTitles.length > 3
            ? ` and ${failedTitles.length - 3} more`
            : "";
        toast.error(`Couldn't remove ${shown}${more} from the bin`);
      }
    } finally {
      setPending(false);
    }
  }, [registryLoading, info, bin, deleteFromBin]);

  return { clearBin, loading: pending || registryLoading };
};

export const useAddToBin = () => {
  const { action, loading } = useBinMutation(useAddToBinMutation, "Failed to add album to bin");
  return { addToBin: action, loading };
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
    isFetching: loading,
  };
};
