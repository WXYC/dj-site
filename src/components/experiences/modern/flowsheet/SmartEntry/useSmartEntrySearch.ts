"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/lib/hooks";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  useFlowsheetResults,
  useFlowsheetResultsLoading,
} from "../Search/FlowsheetSearchProvider";
import { deriveSmartResults } from "./deriveSmartResults";
import type { SmartField } from "./parser/types";

/**
 * Consumes the four search sources from FlowsheetSearchProvider and shapes them
 * into the results display model (narrowed by locks, filtered, deduped, capped;
 * selected match extracted). Kept separate from useFlowsheetSmartEntry so that
 * hook stays provider-free and unit-testable; SmartEntry composes both.
 */
export function useSmartEntrySearch(
  locks: Partial<Record<SmartField, string>>
) {
  const results = useFlowsheetResults();
  const loading = useFlowsheetResultsLoading();
  const filters = useAppSelector(flowsheetSlice.selectors.getSearchFilters);
  const selectedMatch = useAppSelector(
    flowsheetSlice.selectors.getSelectedMatch
  );

  const narrow = typeof window !== "undefined" && window.innerWidth < 600;

  const model = useMemo(
    () =>
      deriveSmartResults({
        results,
        filters,
        locks,
        selectedMatchId: selectedMatch?.id ?? null,
        totalCap: narrow ? 6 : 10,
        baseCap: narrow ? 2 : 3,
      }),
    [results, filters, locks, selectedMatch, narrow]
  );

  const anyFetching =
    loading.binFetching ||
    loading.rotationFetching ||
    loading.catalogFetching ||
    loading.lmlFetching;

  return { ...model, selectedMatch, anyFetching };
}
