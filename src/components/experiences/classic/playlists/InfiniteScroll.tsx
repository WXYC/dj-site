"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Classic-flavored intersection-observer wrapper. Mirrors Modern's
// `PlaylistInfiniteScroll` minus the MUI Joy chrome — pure HTML + the
// Classic .text class for messaging.
export default function InfiniteScroll({
  children,
  hasMore,
  isLoading,
  onLoadMore,
}: {
  children: ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
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
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="classic-previous-sets-scroll">
      {children}
      <div ref={sentinelRef} style={{ height: 1, width: "100%" }} />
      {isLoading && (
        <div
          className="text"
          style={{ textAlign: "center", padding: "1em" }}
        >
          Loading more results...
        </div>
      )}
      {!hasMore && !isLoading && (
        <div
          className="smalltext"
          style={{ textAlign: "center", padding: "0.5em", color: "#888" }}
        >
          End of results
        </div>
      )}
    </div>
  );
}
