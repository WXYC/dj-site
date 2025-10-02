import {
  useAddToBinMutation,
  useDeleteFromBinMutation,
  useGetBinQuery,
} from "@/lib/features/bin/api";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { useAppSelector } from "@/lib/hooks";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";

export const useBin = () => {
  const { loading, info } = useRegistry();

  const { data, isLoading, isSuccess, isError } = useGetBinQuery(
    {
      dj_id: parseInt(info?.id!) || 0,
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

      deleteFromBin({ dj_id: parseInt(info?.id!) || 0, album_id });
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

      addToBin({ dj_id: parseInt(info?.id!) || 0, album_id });
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

export const useBinResults = () => {

  const { bin, loading, isSuccess, isError } = useBin();

  const findInBin = useCallback((query: FlowsheetQuery) => {
    if ((query.album.length + query.artist.length + query.label.length) <= 3 || !bin) return [];
    var searchTerms = [query.album, query.artist, query.label].map((term) => term.toLowerCase());

    var matches = [];

    for (var i = 0; i < bin.length; i++) {
      var item = bin[i];

      var isMatch = false;

      var terms = [
        item.artist?.name.toLowerCase() ?? "",
        item.title?.toLowerCase() ?? "",
        item.label?.toLowerCase() ?? "",
      ];
      for (var j = 0; j < searchTerms.length; j++) {
        var searchTerm = searchTerms[j];

        if (searchTerm.length <= 3) continue;

        // Check if any of the terms match the search term
        var termMatches = terms.some((term) => term.indexOf(searchTerm) !== -1);

        // If the current search term doesn't match any of the terms, break the loop
        if (termMatches) {
          isMatch = true;
          break;
        }
      }

      // If all search terms match any of the terms, add the item to the matches
      if (isMatch) {
        matches.push(item);
      }
    }

    return matches;
  }, [bin]);

  const [searchResults, setSearchResults] = useState<AlbumEntry[]>([]);

  const flowsheetQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  useEffect(() => {
    if (!loading && isSuccess && bin) {
      setSearchResults(findInBin(flowsheetQuery));
    }
  }, [bin, loading, isSuccess, flowsheetQuery]);

  return {
    searchResults
  }
};
