import {
  useAddToBinMutation,
  useDeleteFromBinMutation,
  useGetBinQuery,
} from "@/lib/features/bin/api";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

export const useBin = () => {
  const { loading, info } = useRegistry();

  const { data, isLoading, isSuccess, isError } = useGetBinQuery(
    {
      dj_id: info?.id ?? "",
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

export const useDeleteFromBin = () => {
  const { loading, info } = useRegistry();

  const [deleteFromBin, result] = useDeleteFromBinMutation();

  const deleteMethod = useCallback(
    (album_id: number) => {
      if (loading || !info) return;

      deleteFromBin({ dj_id: info.id, album_id });
    },
    [info, loading, deleteFromBin]
  );

  useEffect(() => {
    if (result.isError) {
      toast.error("Failed to remove album from bin");
    }
  }, [result.isError]);

  return {
    deleteFromBin: deleteMethod,
    loading: result.isLoading || loading,
  };
};

export const useAddToBin = () => {
  const { loading, info } = useRegistry();

  const [addToBin, result] = useAddToBinMutation();

  const addMethod = useCallback(
    (album_id: number) => {
      if (loading || !info) return;

      addToBin({ dj_id: info.id, album_id });
    },
    [info, loading, addToBin]
  );

  useEffect(() => {
    if (result.isError) {
      toast.error("Failed to add album to bin");
    }
  }, [result.isError]);

  return {
    addToBin: addMethod,
    loading: result.isLoading || loading,
  };
};

export const useBinResults = () => {
  const { bin, loading, isSuccess } = useBin();
  const flowsheetQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  // Calculate search results during render with useMemo instead of useState + useEffect
  const searchResults = useMemo(() => {
    if (
      !bin ||
      loading ||
      !isSuccess ||
      flowsheetQuery.album.length + flowsheetQuery.artist.length + flowsheetQuery.label.length <= 3
    ) {
      return [];
    }

    const searchTerms = [flowsheetQuery.album, flowsheetQuery.artist, flowsheetQuery.label].map((term) =>
      term.toLowerCase()
    );

    return bin.filter((item) => {
      const terms = [
        item.artist?.name.toLowerCase() ?? "",
        item.title?.toLowerCase() ?? "",
        item.label?.toLowerCase() ?? "",
      ];

      return searchTerms.some((searchTerm) => {
        if (searchTerm.length <= 3) return false;
        return terms.some((term) => term.includes(searchTerm));
      });
    });
  }, [bin, loading, isSuccess, flowsheetQuery]);

  return {
    searchResults,
  };
};
