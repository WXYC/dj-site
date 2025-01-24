import { useGetAuthenticationQuery } from "@/lib/features/authentication/api";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/slice";
import {
  Genre,
  SearchCatalogQueryParams,
  SearchIn,
} from "@/lib/features/catalog/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useState } from "react";

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
  const MIN_SEARCH_LENGTH = 3;

  const {
    searchString,
    setSearchString,
    setSearchIn,
    setSearchGenre,
    dispatch,
    catalogSlice,
    addSelection,
    removeSelection,
    setSelection,
    clearSelection,
    selected,
    n,
    orderBy
  } = useCatalogSearch();

  const {
    data: userData,
    isLoading: authenticating,
    isSuccess: authenticated,
  } = useGetAuthenticationQuery(undefined, {
    pollingInterval: 2700000,
  });

  const searchIn = useAppSelector(catalogSlice.selectors.getSearchIn);
  const [formattedQuery, setFormattedQuery] =
    useState<SearchCatalogQueryParams>({
      artist_name: String(undefined),
      album_name: String(undefined),
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
        switch (searchIn) {
          case "Albums":
            setFormattedQuery({
              artist_name: String(undefined),
              album_name: searchString,
              n: n,
            });
            break;
          case "Artists":
            setFormattedQuery({
              artist_name: searchString,
              album_name: String(undefined),
              n: n,
            });
            break;
          default:
            setFormattedQuery({
              artist_name: searchString,
              album_name: searchString,
              n: n,
            });
            break;
        }
      }, 500)
    );
  }, [searchIn, searchString, n]);

  useEffect(() => {
    setReachedEndForQuery(false);
  }, [searchIn, searchString]);

  const { data, isLoading, isSuccess, isError } = useSearchCatalogQuery(formattedQuery, {
    skip:
      authenticating ||
      !authenticated ||
      searchString.length < MIN_SEARCH_LENGTH,
  });

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
  }, [data]);

  return {
    data,
    loading: isLoading || loading,
    searchString,
    setSearchString,
    setSearchIn,
    setSearchGenre,
    addSelection,
    removeSelection,
    setSelection,
    clearSelection,
    selected,
    loadMore,
    reachedEndForQuery,
    dispatch,
    catalogSlice,
    orderBy
  };
};
