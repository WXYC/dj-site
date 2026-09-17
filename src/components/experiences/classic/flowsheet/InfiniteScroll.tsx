"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Classic-flavored intersection-observer wrapper, ported from
// `classic/playlists/InfiniteScroll`: an IntersectionObserver watches a
// sentinel's viewport visibility rather than a scroll event on a particular
// element, so it fires correctly from inside `#classic-container` — the
// shell scrollport `globals.css` puts overflow back on, since `html, body`
// clip theirs (see the note in PreviousSetsContainer). A `window`/element
// scroll listener would never fire there. No "end of results" copy: unlike
// the Playlist Archive this paginates the live flowsheet, which keeps
// admitting older shows, so there is no natural end state to announce.
//
// `paused` is the flowsheet's own addition. An observer reports intersection
// *changes*, so any call dropped inside the callback is never retried on its
// own — the caller would have to scroll again to recover it. Taking the gate
// as a dep instead means clearing it re-runs the effect, re-observes, and
// re-delivers the current intersection, so a suppressed load resumes by
// itself. Anything that merely blocks a fetch belongs here rather than in
// the callback body, and it stays distinct from `isLoading` so suppressing a
// load does not flash the loading copy.
export default function InfiniteScroll({
  children,
  hasMore,
  isLoading,
  paused = false,
  onLoadMore,
}: {
  children: ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  /** Blocks a fetch without claiming one is in flight. */
  paused?: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading && !paused) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, paused, onLoadMore]);

  return (
    <div>
      {children}
      <div ref={sentinelRef} style={{ height: 1, width: "100%" }} />
      {isLoading && (
        <div className="text" style={{ textAlign: "center", padding: "1em" }}>
          Loading more entries...
        </div>
      )}
    </div>
  );
}
