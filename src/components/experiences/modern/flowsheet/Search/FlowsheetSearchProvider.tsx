"use client";

import type { AlbumEntry } from "@/lib/features/catalog/types";
import { useFlowsheetSearchResults } from "@/src/hooks/flowsheetHooks";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type FlowsheetResults = {
  binResults: AlbumEntry[];
  rotationResults: AlbumEntry[];
  catalogResults: AlbumEntry[];
  lmlResults: AlbumEntry[];
};

export type FlowsheetResultsLoading = {
  binFetching: boolean;
  rotationFetching: boolean;
  catalogFetching: boolean;
  lmlFetching: boolean;
};

const ResultsCtx = createContext<FlowsheetResults | null>(null);
const ResultsLoadingCtx = createContext<FlowsheetResultsLoading | null>(null);

/**
 * Context distribution over the single search pipeline
 * (useFlowsheetSearchResults). The composer's many leaf components read results
 * through context rather than each calling the pipeline hook, so the four
 * source subscriptions resolve once per render tree instead of once per leaf.
 * The pipeline itself stays the single source shared with useFlowsheetSearch /
 * useFlowsheetSubmit — this provider adds no second gathering/dedup path. (#657)
 */
export function FlowsheetSearchProvider({ children }: { children: ReactNode }) {
  const {
    binResults,
    rotationResults,
    catalogResults,
    lmlResults,
    binFetching,
    rotationFetching,
    catalogFetching,
    lmlFetching,
  } = useFlowsheetSearchResults();

  const results = useMemo<FlowsheetResults>(
    () => ({ binResults, rotationResults, catalogResults, lmlResults }),
    [binResults, rotationResults, catalogResults, lmlResults]
  );

  const loading = useMemo<FlowsheetResultsLoading>(
    () => ({ binFetching, rotationFetching, catalogFetching, lmlFetching }),
    [binFetching, rotationFetching, catalogFetching, lmlFetching]
  );

  return (
    <ResultsCtx.Provider value={results}>
      <ResultsLoadingCtx.Provider value={loading}>
        {children}
      </ResultsLoadingCtx.Provider>
    </ResultsCtx.Provider>
  );
}

export function useFlowsheetResults() {
  const ctx = useContext(ResultsCtx);
  if (!ctx) {
    throw new Error("useFlowsheetResults outside FlowsheetSearchProvider");
  }
  return ctx;
}

export function useFlowsheetResultsLoading() {
  const ctx = useContext(ResultsLoadingCtx);
  if (!ctx) {
    throw new Error(
      "useFlowsheetResultsLoading outside FlowsheetSearchProvider"
    );
  }
  return ctx;
}

export function useFlowsheetAllResults() {
  const { binResults, rotationResults, catalogResults, lmlResults } =
    useFlowsheetResults();
  return useMemo(
    () => [...binResults, ...rotationResults, ...catalogResults, ...lmlResults],
    [binResults, rotationResults, catalogResults, lmlResults]
  );
}
