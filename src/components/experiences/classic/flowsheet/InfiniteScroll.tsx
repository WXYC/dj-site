"use client";

import { useEffect, useRef, type ReactNode } from "react";

// An IntersectionObserver watches the sentinel's viewport visibility rather
// than a scroll event on a particular element, because Classic scrolls the
// shell's container: `html, body` clip their overflow and `#classic-container`
// is where `globals.css` puts the scrollport back (see the note in
// PreviousSetsContainer). A `window`/element scroll listener never fires there.
//
// Every gate below is an effect dependency rather than a check inside the
// callback. An observer reports intersection *changes*, so a call dropped
// inside the callback is never retried on its own — the caller would have to
// scroll again to recover it. As a dep, clearing the gate re-observes and
// re-delivers the current intersection, so a suppressed load resumes by itself.
//
// No "end of results" copy: this paginates the live flowsheet, which keeps
// admitting older shows, so there is no natural end state to announce.
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
