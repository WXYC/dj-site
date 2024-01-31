/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const getQuery = (state: ReduxState) => state.catalog.query;
export const getResults = (state: ReduxState) => state.catalog.results;

export const getOrderBy = (state: ReduxState) => state.catalog.orderBy;
export const getOrderDirection = (state: ReduxState) => state.catalog.orderDirection;
export const getReachedEnd = (state: ReduxState) => state.catalog.noResultsRemain;

export const getCatalogLoading = (state: ReduxState) => state.catalog.loading;