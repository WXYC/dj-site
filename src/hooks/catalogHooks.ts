import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import {
  AlbumEntry,
  Genre,
  SearchCatalogQueryParams,
  SearchIn,
} from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useGetRotationQuery } from "@/lib/features/rotation/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useState } from "react";
import { createAuthenticatedHooks } from "./createAuthenticatedHooks";

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

const _useCatalogResults = () => {
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

  const { data, isLoading, isSuccess, isError } = useSearchCatalogQuery(
    formattedQuery,
    {
      skip: searchString.length < MIN_SEARCH_LENGTH,
    }
  );

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
    loadMore,
    reachedEndForQuery,
    dispatch,
    catalogSlice,
  };
};

export const useCatalogResults = createAuthenticatedHooks(_useCatalogResults);

const _useCatalogFlowsheetSearch = () => {
  const MIN_SEARCH_LENGTH = 2;

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

export const useCatalogFlowsheetSearch = createAuthenticatedHooks(_useCatalogFlowsheetSearch);

const _useRotationFlowsheetSearch = () => {
  const MIN_SEARCH_LENGTH = 2;

  const rotationQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const { data, isLoading, isSuccess } = useGetRotationQuery(undefined);

  const findInRotation = useCallback(
    (query: FlowsheetQuery) => {
      if (
        query.album.length + query.artist.length + query.label.length <= 3 ||
        !data
      )
        return [];
      var searchTerms = [query.album, query.artist, query.label].map((term) =>
        term.toLowerCase()
      );

      var matches = [];

      for (var i = 0; i < data.length; i++) {
        var item = data[i];

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
          var termMatches = terms.some(
            (term) => term.indexOf(searchTerm) !== -1
          );

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
    },
    [data]
  );

  useEffect(() => {
    if (!isLoading && isSuccess && data) {
      setSearchResults(findInRotation(rotationQuery));
    }
  }, [data, isLoading, isSuccess, rotationQuery]);

  const [searchResults, setSearchResults] = useState<AlbumEntry[]>([]);

  return {
    searchResults:
      rotationQuery.artist.length + rotationQuery.album.length >
      MIN_SEARCH_LENGTH
        ? searchResults
        : [],
    loading: isLoading,
  };
};

export const useRotationFlowsheetSearch = createAuthenticatedHooks(_useRotationFlowsheetSearch);
