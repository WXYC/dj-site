import { useEffect } from "react";

/**
 * Tells the control's parent whether the control holds a draft it has not
 * saved, so the parent can mark it (the release card's editor marks the tab).
 * Reports `false` on mount. `onUnsavedChange` should keep one identity across
 * renders; a fresh function each render only costs a repeat report.
 */
export function useReportUnsaved(
  unsaved: boolean,
  onUnsavedChange: ((unsaved: boolean) => void) | undefined,
): void {
  // The draft is the control's local state, written by many setters, and the
  // marker is the parent's; this carries the derived value across that
  // boundary once a render has settled it, which no single handler can.
  useEffect(() => {
    onUnsavedChange?.(unsaved);
  }, [unsaved, onUnsavedChange]);
}
