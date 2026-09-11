"use client";

import { useLayoutEffect, type RefObject } from "react";

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
 *
 * The scrollport arrives as a resolver rather than as a ref or an id, for two
 * reasons that happen to agree. One caller renders its own box and the other
 * does not — classic's belongs to the shell above it — so there is no single
 * handle type to take. And writing `scrollTop` through a value traced back to a
 * hook argument reads to the React compiler as mutating that argument; resolving
 * it through a call is what makes the write the caller's own element again.
 *
 * The resolver must be stable: it is an honest dependency, and re-running the
 * restore every render would fight the reader for the scrollbar.
 */
export function useRetainedScrollOffset(
  retained: RefObject<number> | undefined,
  resolveScrollport: () => HTMLElement | null,
): void {
  useLayoutEffect(() => {
    const scrollport = resolveScrollport();
    if (!scrollport || !retained) return;

    scrollport.scrollTop = retained.current;
    return () => {
      retained.current = scrollport.scrollTop;
    };
  }, [retained, resolveScrollport]);
}
