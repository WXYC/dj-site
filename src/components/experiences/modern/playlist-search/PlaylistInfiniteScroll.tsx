"use client";

import { Box, CircularProgress, Sheet, Typography } from "@mui/joy";
import { useEffect, useRef } from "react";

interface PlaylistInfiniteScrollProps {
  children: React.ReactNode;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

export default function PlaylistInfiniteScroll({
  children,
  hasMore,
  isLoading,
  onLoadMore,
}: PlaylistInfiniteScrollProps) {
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

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <Sheet
      sx={{
        maxHeight: "calc(100vh - 350px)",
        minHeight: 400,
        overflowY: "auto",
        background: "transparent",
        borderRadius: "sm",
      }}
    >
      {children}

      {/* Sentinel element for intersection observer */}
      <Box
        ref={sentinelRef}
        sx={{
          height: 1,
          width: "100%",
        }}
      />

      {/* Loading indicator at bottom */}
      {isLoading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: 3,
          }}
        >
          <CircularProgress size="sm" />
          <Typography level="body-sm" sx={{ ml: 1, color: "text.secondary" }}>
            Loading more results...
          </Typography>
        </Box>
      )}

      {/* End of results indicator */}
      {!hasMore && !isLoading && (
        <Box sx={{ textAlign: "center", py: 2 }}>
          <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
            End of results
          </Typography>
        </Box>
      )}
    </Sheet>
  );
}
