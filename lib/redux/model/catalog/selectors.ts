/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const getQuery = (state: ReduxState) => state.catalog.query;
export const getResults = (state: ReduxState) => state.catalog.results;

export const getSearchIn = (state: ReduxState) => state.catalog.searchIn;
export const getGenre = (state: ReduxState) => state.catalog.genre;

export const getOrderBy = (state: ReduxState) => state.catalog.orderBy;
export const getOrderDirection = (state: ReduxState) => state.catalog.orderDirection;
export const getReachedEnd = (state: ReduxState) => state.catalog.noResultsRemain;

export const getN = (state: ReduxState) => state.catalog.resultCount;

export const getCatalogLoading = (state: ReduxState) => state.catalog.loading;