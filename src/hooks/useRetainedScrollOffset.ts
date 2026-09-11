"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Carries a scrollport's offset across an unmount of the thing that filled it.
 *
 * Neither playlists listing scrolls the document: `html, body` clip their
 * overflow, modern's listing scrolls inside its own panel and classic's inside
 * the shell's `#classic-container` (see `src/styles/globals.css`). The browser
 * restores document scroll and nothing else, so an inner offset survives only
 * if something holds it — which is what `retained` is, a ref living above the
 * branch that does the unmounting.
 *
 * The offset is recorded in the cleanup rather than on every scroll event:
 * layout-effect cleanups run before React detaches the node, so the read is of
 * a still-attached, still-scrolled element, and one read beats hundreds.
 */
export function useRetainedScrollOffset(
  retained: RefObject<number> | undefined,
  resolveScrollport: () => HTMLElement | null,
): void {
  // Held in a ref so an inline resolver cannot become an effect dependency.
  // Re-running this on every render would re-restore the offset mid-gesture and
  // fight the reader for the scrollbar.
  const resolve = useRef(resolveScrollport);
  resolve.current = resolveScrollport;

  useLayoutEffect(() => {
    const scrollport = resolve.current();
    if (!scrollport || !retained) return;

    scrollport.scrollTop = retained.current;
    return () => {
      retained.current = scrollport.scrollTop;
    };
  }, [retained]);
}
