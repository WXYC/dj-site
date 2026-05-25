import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React, { createRef } from "react";
import CatalogInfiniteScroller from "./CatalogInfiniteScroller";

function setUpScrollContainer(
  element: HTMLElement,
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
) {
  Object.defineProperty(element, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(element, "scrollTop", {
    value: scrollTop,
    configurable: true,
  });
  Object.defineProperty(element, "clientHeight", {
    value: clientHeight,
    configurable: true,
  });
}

describe("CatalogInfiniteScroller", () => {
  const onLoadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onLoadMore when scrolled near the bottom", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollRef}>
        <CatalogInfiniteScroller
          scrollRef={scrollRef}
          onLoadMore={onLoadMore}
          hasNextPage
          isLoadingInitial={false}
          isFetchingMore={false}
        >
          <div>Tall content</div>
        </CatalogInfiniteScroller>
      </div>,
    );

    const scroller = container.firstChild as HTMLElement;
    setUpScrollContainer(scroller, 500, 1000, 500);
    fireEvent.scroll(scroller);

    expect(onLoadMore).toHaveBeenCalled();
  });

  it("does not call onLoadMore while loading initial page", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollRef}>
        <CatalogInfiniteScroller
          scrollRef={scrollRef}
          onLoadMore={onLoadMore}
          hasNextPage
          isLoadingInitial
          isFetchingMore={false}
        >
          <div>Content</div>
        </CatalogInfiniteScroller>
      </div>,
    );

    const scroller = container.firstChild as HTMLElement;
    setUpScrollContainer(scroller, 500, 1000, 500);
    fireEvent.scroll(scroller);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not call onLoadMore while fetching more", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollRef}>
        <CatalogInfiniteScroller
          scrollRef={scrollRef}
          onLoadMore={onLoadMore}
          hasNextPage
          isLoadingInitial={false}
          isFetchingMore
        >
          <div>Content</div>
        </CatalogInfiniteScroller>
      </div>,
    );

    const scroller = container.firstChild as HTMLElement;
    setUpScrollContainer(scroller, 500, 1000, 500);
    fireEvent.scroll(scroller);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not call onLoadMore when hasNextPage is false", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollRef}>
        <CatalogInfiniteScroller
          scrollRef={scrollRef}
          onLoadMore={onLoadMore}
          hasNextPage={false}
          isLoadingInitial={false}
          isFetchingMore={false}
        >
          <div>Content</div>
        </CatalogInfiniteScroller>
      </div>,
    );

    const scroller = container.firstChild as HTMLElement;
    setUpScrollContainer(scroller, 500, 1000, 500);
    fireEvent.scroll(scroller);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not call onLoadMore when not near the bottom", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={scrollRef}>
        <CatalogInfiniteScroller
          scrollRef={scrollRef}
          onLoadMore={onLoadMore}
          hasNextPage
          isLoadingInitial={false}
          isFetchingMore={false}
        >
          <div>Content</div>
        </CatalogInfiniteScroller>
      </div>,
    );

    const scroller = container.firstChild as HTMLElement;
    setUpScrollContainer(scroller, 100, 1000, 500);
    fireEvent.scroll(scroller);

    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
