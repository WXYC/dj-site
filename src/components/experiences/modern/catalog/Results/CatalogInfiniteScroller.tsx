"use client";

import { useEffect, type RefObject } from "react";

const BOTTOM_SCROLL_SLACK_PX = 100;

export default function CatalogInfiniteScroller({
  scrollRef,
  onLoadMore,
  hasNextPage,
  isLoadingInitial,
  isFetchingMore,
  children,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  onLoadMore: () => void;
  hasNextPage: boolean;
  isLoadingInitial: boolean;
  isFetchingMore: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      const scrolledToBottom =
        scroller.scrollHeight <=
        scroller.scrollTop + scroller.clientHeight + BOTTOM_SCROLL_SLACK_PX;

      if (
        scrolledToBottom &&
        !isLoadingInitial &&
        !isFetchingMore &&
        hasNextPage
      ) {
        onLoadMore();
      }
    };

    scroller.addEventListener("scroll", onScroll);
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [
    scrollRef,
    onLoadMore,
    hasNextPage,
    isLoadingInitial,
    isFetchingMore,
  ]);

  return <>{children}</>;
}
