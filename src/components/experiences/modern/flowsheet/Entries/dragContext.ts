import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { createContext, useContext } from "react";

/**
 * Drag lifecycle callbacks supplied by whichever page owns the Reorder.Group.
 * DraggableEntryWrapper is shared between the live flowsheet (drag end hits
 * the backend) and the client-only queue (drag end only touches Redux); the
 * context keeps that page-specific behavior out of the shared row components.
 * Defaults to no-ops so unwrapped consumers never crash.
 */
export type FlowsheetDragContextValue = {
  onEntryDragStart: () => void;
  onEntryDragEnd: (entry: FlowsheetEntry) => void;
};

const NOOP_DRAG_CONTEXT: FlowsheetDragContextValue = {
  onEntryDragStart: () => {},
  onEntryDragEnd: () => {},
};

export const FlowsheetDragContext =
  createContext<FlowsheetDragContextValue>(NOOP_DRAG_CONTEXT);

export const useFlowsheetDragContext = () => useContext(FlowsheetDragContext);
