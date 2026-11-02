"use client";

import type { JSX } from "react";
import { VISUALLY_HIDDEN } from "./visuallyHidden";

/**
 * The screen-reader half of a loading state. Surfaces show spinners and
 * skeletons, never visible status text, so this always-mounted, visually
 * hidden polite region carries the words instead ("Loading rotation",
 * "36 active records"). It must exist before its text changes, or the change
 * is not announced — so render it unconditionally and vary only `message`.
 */
export default function StatusRegion({ message }: { message: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  );
}
