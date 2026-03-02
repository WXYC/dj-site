"use client";

import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Sheet } from "@mui/joy";
import { useEffect, useRef } from "react";

export default function InfiniteScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { loading, isFetching, hasNextPage, fetchNextPage } = useFlowsheet();

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const scrolledToBottom =
        scroller.scrollHeight ===
        scroller.scrollTop + scroller.clientHeight;

      if (scrolledToBottom && !loading && !isFetching && hasNextPage) {
        fetchNextPage();
      }
    };

    scroller.addEventListener("scroll", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [loading, isFetching, hasNextPage, fetchNextPage]);

  return (
    <Sheet
      ref={scrollRef}
      sx={{
        maxHeight: "calc(100vh - 200px)",
        overflowY: "auto",
        background: "transparent",
        mt: 2,
        overflowX: "visible",
      }}
    >
      {children}
    </Sheet>
  );
}
