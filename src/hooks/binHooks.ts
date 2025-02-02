import { useGetBinQuery } from "@/lib/features/bin/api";
import { useRegistry } from "./authenticationHooks";
import { useEffect } from "react";

export const useBin = () => {
  const { loading, info } = useRegistry();

  const { data, isLoading, isSuccess, isError } = useGetBinQuery(
    {
      dj_id: info?.id,
    },
    {
      skip: !info || loading,
    }
  );

  useEffect(() => {
    if (isSuccess) {
      console.log(data);
    }
  }, [data]);

  return {
    bin: data,
    loading: isLoading || loading,
    isSuccess,
    isError,
  };
};
