/* Instruments */
import type { ReduxState } from "@/lib/redux";

export const getQuery = (state: ReduxState) => state.catalog.query;
export const getResults = (state: ReduxState) => state.catalog.results;