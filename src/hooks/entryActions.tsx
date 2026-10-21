"use client";

import { createContext, useContext, useMemo } from "react";
import type { FlowsheetUpdateParams } from "@/lib/features/flowsheet/types";
import { useFlowsheetActions } from "@/src/hooks/flowsheetHooks";

export type EntryActions = {
  updateFlowsheet: (params: FlowsheetUpdateParams) => void;
  removeFromFlowsheet: (entryId: number) => void;
  /**
   * The rows belong to a past show, so their controls cannot be gated on the
   * live show: a manager editing an archived set is not on the air.
   */
  pastShow: boolean;
};

const EntryActionsContext = createContext<EntryActions | null>(null);

export const EntryActionsProvider = EntryActionsContext.Provider;

/**
 * What a flowsheet row's edit and remove controls call. Defaults to the live
 * flowsheet's mutations; the past-show page supplies its own so a row never
 * patches the live entries cache for a show that is not in it.
 */
export function useEntryActions(): EntryActions {
  const { updateFlowsheet, removeFromFlowsheet } = useFlowsheetActions();
  const supplied = useContext(EntryActionsContext);
  return useMemo(
    () => supplied ?? { updateFlowsheet, removeFromFlowsheet, pastShow: false },
    [supplied, updateFlowsheet, removeFromFlowsheet],
  );
}
