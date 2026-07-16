import type { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useBinResults } from "@/src/hooks/binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "@/src/hooks/catalogHooks";
import { useLmlLibrarySearch } from "@/src/hooks/lml";
import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";

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

export function FlowsheetSearchProvider({ children }: { children: ReactNode }) {
  const { searchResults: binResults, isFetching: binFetching } =
    useBinResults();
  const { searchResults: catalogResults, isFetching: catalogFetching } =
    useCatalogFlowsheetSearch();
  const { searchResults: rotationResults, isFetching: rotationFetching } =
    useRotationFlowsheetSearch();
  const query = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const { results: rawLmlResults, isLoading: lmlFetching } =
    useLmlLibrarySearch({
      artist: query.artist,
      album: query.album,
    });

  const results = useMemo<FlowsheetResults>(() => {
    const seen = new Set<number>();
    for (const r of binResults) seen.add(r.id);
    for (const r of rotationResults) seen.add(r.id);
    for (const r of catalogResults) seen.add(r.id);
    const lmlResults = rawLmlResults.filter((r) => !seen.has(r.id));
    return { binResults, rotationResults, catalogResults, lmlResults };
  }, [binResults, rotationResults, catalogResults, rawLmlResults]);

  const loading = useMemo<FlowsheetResultsLoading>(
    () => ({
      binFetching,
      rotationFetching,
      catalogFetching,
      lmlFetching,
    }),
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
    throw new Error("useFlowsheetResultsLoading outside FlowsheetSearchProvider");
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
