import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import {
  Genre,
  SearchCatalogQueryParams,
  SearchIn,
} from "@/lib/features/catalog/types";

export function formatCatalogSearchQuery(
  searchIn: SearchIn,
  searchString: string,
  n: number
): SearchCatalogQueryParams {
  switch (searchIn) {
    case "Albums":
      return { artist_name: undefined, album_name: searchString, n };
    case "Artists":
      return { artist_name: searchString, album_name: undefined, n };
    default:
      return { artist_name: searchString, album_name: searchString, n };
  }
}
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthentication } from "./authenticationHooks";

export const useCatalogSearch = () => {
  const dispatch = useAppDispatch();
  const searchString = useAppSelector(catalogSlice.selectors.getSearchQuery);
  const setSearchString = (query: string) =>
    dispatch(catalogSlice.actions.setSearchQuery(query));
  const setSearchIn = (inWhat: SearchIn) =>
    dispatch(catalogSlice.actions.setSearchIn(inWhat));
  const setSearchGenre = (genre: Genre | "All") =>
    dispatch(catalogSlice.actions.setSearchGenre(genre));
  const addSelection = (id: number) =>
    dispatch(catalogSlice.actions.addSelection(id));
  const removeSelection = (id: number) =>
    dispatch(catalogSlice.actions.removeSelection(id));
  const setSelection = (ids: number[]) =>
    dispatch(catalogSlice.actions.setSelection(ids));
  const clearSelection = () => dispatch(catalogSlice.actions.clearSelection());
  const selected = useAppSelector(catalogSlice.selectors.getSelected);

  const { n, orderBy, orderDirection } = useAppSelector(
    catalogSlice.selectors.getSearchParams
  );

  const handleRequestSort = useCallback(
    (value: string) => {
      dispatch(
        catalogSlice.actions.setSearchParams({
          orderBy: value,
          orderDirection:
            orderBy === value
              ? orderDirection === "asc"
                ? "desc"
                : "asc"
              : orderDirection,
        })
      );
    },
    [orderBy, orderDirection]
  );

  return {
    searchString,
    setSearchString,
    setSearchIn,
    setSearchGenre,
    orderBy,
    orderDirection,
    handleRequestSort,
    dispatch,
    catalogSlice,
    addSelection,
    removeSelection,
    setSelection,
    clearSelection,
    selected,
    n,
  };
};

export const useCatalogResults = () => {
  const MIN_SEARCH_LENGTH = 2;

  const {
    searchString,
    setSearchString,
    setSearchIn,
    setSearchGenre,
    dispatch,
    catalogSlice,
    addSelection,
    removeSelection,
    clearSelection,
    n,
  } = useCatalogSearch();

  const { authenticating, authenticated } = useAuthentication();

  const searchIn = useAppSelector(catalogSlice.selectors.getSearchIn);
  const [formattedQuery, setFormattedQuery] =
    useState<SearchCatalogQueryParams>({
      artist_name: undefined,
      album_name: undefined,
      n: 10,
    });
  const loadMore = () => dispatch(catalogSlice.actions.loadMore());

  const [loading, setLoading] = useState(false);
  const [reachedEndForQuery, setReachedEndForQuery] = useState(false);
  const [queryTimeout, setQueryTimeout] = useState<
    NodeJS.Timeout | undefined
  >();

  useEffect(() => {
    clearTimeout(queryTimeout);
    setQueryTimeout(
      setTimeout(() => {
        setLoading(true);
        clearSelection();
        setFormattedQuery(formatCatalogSearchQuery(searchIn, searchString, n));
      }, 500)
    );
  }, [searchIn, searchString, n]);

  useEffect(() => {
    setReachedEndForQuery(false);
  }, [searchIn, searchString]);

  const { data, isLoading, isSuccess, isError } = useSearchCatalogQuery(
    formattedQuery,
    {
      skip:
        authenticating ||
        !authenticated ||
        searchString.length < MIN_SEARCH_LENGTH,
    }
  );

  // Calculate loading state during render - simpler than separate useEffect
  const combinedLoading = useMemo(() => {
    return isLoading || loading;
  }, [isLoading, loading]);

  const [lastData, setLastData] = useState(0);
  useEffect(() => {
    if (isSuccess || isError) {
      setLoading(false);
    }
    if (data?.length === lastData) {
      setReachedEndForQuery(true);
    } else {
      setLastData(data?.length ?? 0);
    }
  }, [data, isSuccess, isError, lastData]);

  return {
    data,
    loading: combinedLoading,
    searchString,
    setSearchString,
    setSearchIn,
    setSearchGenre,
    addSelection,
    removeSelection,
    loadMore,
    reachedEndForQuery,
    dispatch,
    catalogSlice,
  };
};

export const useCatalogFlowsheetSearch = () => {
  const MIN_SEARCH_LENGTH = 2;

  const { authenticating, authenticated } = useAuthentication();

  const flowsheetQuery = useAppSelector(
    flowsheetSlice.selectors.getSearchQuery
  );

  const { data } = useSearchCatalogQuery(
    {
      artist_name: flowsheetQuery.artist,
      album_name: flowsheetQuery.album,
      n: 10,
    },
    {
      skip:
        authenticating ||
        !authenticated ||
        flowsheetQuery.artist.length + flowsheetQuery.album.length <=
          MIN_SEARCH_LENGTH,
    }
  );

  return {
    searchResults:
      flowsheetQuery.artist.length + flowsheetQuery.album.length >
      MIN_SEARCH_LENGTH
        ? data ?? []
        : [],
  };
};

export const useRotationFlowsheetSearch = () => {
  const MIN_SEARCH_LENGTH = 2;

  const { authenticating, authenticated } = useAuthentication();

  const rotationQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const { data, isLoading, isSuccess } = useGetRotationQuery(undefined, {
    skip: authenticating || !authenticated,
  });

  // Calculate search results during render with useMemo instead of useState + useEffect
  const searchResults = useMemo(() => {
    if (
      !data ||
      isLoading ||
      !isSuccess ||
      rotationQuery.album.length + rotationQuery.artist.length + rotationQuery.label.length <= 3
    ) {
      return [];
    }

    const searchTerms = [rotationQuery.album, rotationQuery.artist, rotationQuery.label]
      .map((term) => term.toLowerCase())
      .filter((term) => term.length > 3);

    return data.filter((item) => {
      const terms = [
        item.artist?.name.toLowerCase() ?? "",
        item.title?.toLowerCase() ?? "",
        item.label?.toLowerCase() ?? "",
      ];

      return searchTerms.some((searchTerm) =>
        terms.some((term) => term.includes(searchTerm))
      );
    });
  }, [data, isLoading, isSuccess, rotationQuery]);

  return {
    searchResults:
      rotationQuery.artist.length + rotationQuery.album.length > MIN_SEARCH_LENGTH
        ? searchResults
        : [],
    loading: isLoading,
  };
};
