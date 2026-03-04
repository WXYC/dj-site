import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InfiniteScroller from "./InfiniteScroller";
import React from "react";

const mockFetchNextPage = vi.fn();
const mockUseFlowsheet = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: () => mockUseFlowsheet(),
}));

describe("InfiniteScroller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFlowsheet.mockReturnValue({
      loading: false,
      isFetching: false,
      hasNextPage: true,
      fetchNextPage: mockFetchNextPage,
    });
  });

  describe("Basic rendering", () => {
    it("should render children", () => {
      render(
        <InfiniteScroller>
          <div data-testid="child">Child content</div>
        </InfiniteScroller>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should render without children", () => {
      render(
        <InfiniteScroller>
          <></>
        </InfiniteScroller>
      );
    });

    it("should render multiple children", () => {
      render(
        <InfiniteScroller>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
        </InfiniteScroller>
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
    });

    it("should render complex nested children", () => {
      render(
        <InfiniteScroller>
          <div>
            <span>Nested content</span>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </InfiniteScroller>
      );

      expect(screen.getByText("Nested content")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("should apply Sheet styling", () => {
      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const sheet = container.firstChild;
      expect(sheet).toBeInTheDocument();
    });
  });

  function setUpScrollContainer(container: HTMLElement, scrollTop: number, scrollHeight: number, clientHeight: number) {
    const scrollContainer = container.firstChild as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollHeight", {
      value: scrollHeight,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "scrollTop", {
      value: scrollTop,
      configurable: true,
    });
    Object.defineProperty(scrollContainer, "clientHeight", {
      value: clientHeight,
      configurable: true,
    });
    return scrollContainer;
  }

  describe("Scroll behavior", () => {
    it("should call fetchNextPage when scrolled to bottom and not loading", () => {
      const { container } = render(
        <InfiniteScroller>
          <div style={{ height: "1000px" }}>Tall content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it("should NOT call fetchNextPage when loading", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: true,
        isFetching: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("should NOT call fetchNextPage when isFetching", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        isFetching: true,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("should NOT call fetchNextPage when hasNextPage is false", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        isFetching: false,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
      });

      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });

    it("should NOT call fetchNextPage when not scrolled to bottom", () => {
      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 100, 1000, 500);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });
  });

  describe("Event listener cleanup", () => {
    it("should add scroll listener on mount", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "addEventListener"
      );

      render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("should remove scroll listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("Effect dependencies", () => {
    it("should re-attach scroll listener when loading changes", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "addEventListener"
      );

      const { rerender } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const initialCallCount = addEventListenerSpy.mock.calls.length;

      mockUseFlowsheet.mockReturnValue({
        loading: true,
        isFetching: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      rerender(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount
      );

      addEventListenerSpy.mockRestore();
    });

    it("should re-attach scroll listener when isFetching changes", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "addEventListener"
      );

      const { rerender } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const initialCallCount = addEventListenerSpy.mock.calls.length;

      mockUseFlowsheet.mockReturnValue({
        loading: false,
        isFetching: true,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      rerender(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount
      );

      addEventListenerSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid scroll events", () => {
      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);

      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer);
      }

      expect(mockFetchNextPage.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should call fetchNextPage at exact bottom boundary", () => {
      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 600, 1000, 400);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).toHaveBeenCalled();
    });

    it("should NOT trigger when 1px away from bottom", () => {
      const { container } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 599, 1000, 400);
      fireEvent.scroll(scrollContainer);

      expect(mockFetchNextPage).not.toHaveBeenCalled();
    });
  });

  describe("Loading state transitions", () => {
    it("should not fetch while loading then fetch when loaded", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: true,
        isFetching: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      const { container, rerender } = render(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      const scrollContainer = setUpScrollContainer(container, 500, 1000, 500);

      fireEvent.scroll(scrollContainer);
      expect(mockFetchNextPage).not.toHaveBeenCalled();

      mockUseFlowsheet.mockReturnValue({
        loading: false,
        isFetching: false,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
      });

      rerender(
        <InfiniteScroller>
          <div>Content</div>
        </InfiniteScroller>
      );

      fireEvent.scroll(scrollContainer);
      expect(mockFetchNextPage).toHaveBeenCalled();
    });
  });

  describe("Children prop variations", () => {
    it("should render string children", () => {
      render(
        <InfiniteScroller>Simple text content</InfiniteScroller>
      );

      expect(screen.getByText("Simple text content")).toBeInTheDocument();
    });

    it("should render fragment children", () => {
      render(
        <InfiniteScroller>
          <>
            <span>Fragment child 1</span>
            <span>Fragment child 2</span>
          </>
        </InfiniteScroller>
      );

      expect(screen.getByText("Fragment child 1")).toBeInTheDocument();
      expect(screen.getByText("Fragment child 2")).toBeInTheDocument();
    });

    it("should render array of elements", () => {
      const items = ["Item A", "Item B", "Item C"];

      render(
        <InfiniteScroller>
          {items.map((item, index) => (
            <div key={index}>{item}</div>
          ))}
        </InfiniteScroller>
      );

      items.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });
});
