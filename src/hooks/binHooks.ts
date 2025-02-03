import {
  useAddToBinMutation,
  useDeleteFromBinMutation,
  useGetBinQuery,
} from "@/lib/features/bin/api";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";

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

export const useDeleteFromBin = () => {
  const { loading, info } = useRegistry();

  const [deleteFromBin, result] = useDeleteFromBinMutation();

  const deleteMethod = useCallback(
    (album_id: number) => {
      if (loading || !info) return;

      deleteFromBin({ dj_id: info?.id!, album_id });
    },
    [info, loading]
  );

  useEffect(() => {
    if (result.isError) {
      toast.error("Failed to remove album from bin");
    }
  }, [result]);

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

      addToBin({ dj_id: info?.id!, album_id });
    },
    [info, loading]
  );

  useEffect(() => {
    if (result.isError) {
      toast.error("Failed to add album to bin");
    }
  }, [result]);

  return {
    addToBin: addMethod,
    loading: result.isLoading || loading,
  };
};
