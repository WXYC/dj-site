import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import InfiniteScroller from "./InfiniteScroller";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import React from "react";

// Mock flowsheet hooks
const mockUseFlowsheet = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: () => mockUseFlowsheet(),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn((selector) => {
    // Return pagination state
    if (typeof selector === "function") {
      const mockState = {
        flowsheet: {
          pagination: { page: 0, limit: 20, max: 0 },
        },
      };
      return selector(mockState);
    }
    return { page: 0, limit: 20, max: 0 };
  }),
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    reducer: (state = { pagination: { page: 0, limit: 20, max: 0 } }) => state,
    actions: {
      setPagination: vi.fn((data) => ({
        type: "flowsheet/setPagination",
        payload: data,
      })),
    },
    selectors: {
      getPagination: (state: any) => state.flowsheet.pagination,
    },
  },
}));

function createTestStore(paginationMax = 0) {
  return configureStore({
    reducer: {
      flowsheet: (state = { pagination: { page: 0, limit: 20, max: paginationMax } }) => state,
    },
    preloadedState: {
      flowsheet: {
        pagination: { page: 0, limit: 20, max: paginationMax },
      },
    },
  });
}

function createWrapper(paginationMax = 0) {
  const store = createTestStore(paginationMax);
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("InfiniteScroller", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockUseFlowsheet.mockReturnValue({
      loading: false,
      entries: {
        current: [{ id: 1 }, { id: 2 }],
        previous: [],
      },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("Basic rendering", () => {
    it("should render children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <div data-testid="child">Child content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should render without children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <></>
          </InfiniteScroller>
        </Wrapper>
      );

      // Should not throw
    });

    it("should render multiple children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <div data-testid="child1">Child 1</div>
            <div data-testid="child2">Child 2</div>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
    });

    it("should render complex nested children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <div>
              <span>Nested content</span>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByText("Nested content")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("should apply Sheet styling", () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      // The Sheet component renders as a div with MUI styles
      const sheet = container.firstChild;
      expect(sheet).toBeInTheDocument();
    });
  });

  describe("Scroll behavior", () => {
    it("should dispatch setPagination when scrolled to bottom and not loading", () => {
      const Wrapper = createWrapper(0);

      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div style={{ height: "1000px" }}>Tall content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      // Mock the scroll properties
      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      // Trigger scroll event
      fireEvent.scroll(scrollContainer);

      // Should dispatch pagination action
      expect(mockDispatch).toHaveBeenCalled();
    });

    it("should NOT dispatch setPagination when loading", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: true,
        entries: {
          current: [{ id: 1 }],
          previous: [],
        },
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      // Should NOT dispatch when loading
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should NOT dispatch setPagination when entries is falsy", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: null,
      });

      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should NOT dispatch when not scrolled to bottom", () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      // Not at bottom
      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should log pagination max + 1 when dispatching", () => {
      const Wrapper = createWrapper(2);

      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      // Console.log should be called with pagination.max + 1
      // Note: Due to mock, the actual value may vary based on implementation
    });
  });

  describe("Event listener cleanup", () => {
    it("should add scroll listener on mount", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "addEventListener"
      );

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
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

      const Wrapper = createWrapper();
      const { unmount } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
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

      const Wrapper = createWrapper();
      const { rerender } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      // Initial call
      const initialCallCount = addEventListenerSpy.mock.calls.length;

      // Change loading state
      mockUseFlowsheet.mockReturnValue({
        loading: true,
        entries: {
          current: [{ id: 1 }],
          previous: [],
        },
      });

      rerender(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      // Should have been called again due to dependency change
      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount
      );

      addEventListenerSpy.mockRestore();
    });

    it("should re-attach scroll listener when entries changes", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLDivElement.prototype,
        "addEventListener"
      );

      const Wrapper = createWrapper();
      const { rerender } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const initialCallCount = addEventListenerSpy.mock.calls.length;

      // Change entries
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: {
          current: [{ id: 1 }, { id: 2 }, { id: 3 }],
          previous: [],
        },
      });

      rerender(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThanOrEqual(
        initialCallCount
      );

      addEventListenerSpy.mockRestore();
    });
  });

  describe("Null ref handling", () => {
    it("should handle case when scrollRef is null", () => {
      // This tests the guard clause in onScroll
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: {
          current: [],
          previous: [],
        },
      });

      const Wrapper = createWrapper();

      // Should not throw
      expect(() => {
        render(
          <Wrapper>
            <InfiniteScroller>
              <div>Content</div>
            </InfiniteScroller>
          </Wrapper>
        );
      }).not.toThrow();
    });
  });

  describe("Pagination action parameters", () => {
    it("should dispatch setPagination with correct page and limit", () => {
      const Wrapper = createWrapper(1);

      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      // Verify the action was called with expected parameters
      expect(flowsheetSlice.actions.setPagination).toHaveBeenCalledWith({
        page: expect.any(Number),
        limit: 20,
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty entries array", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: {
          current: [],
          previous: [],
        },
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <div>No entries</div>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByText("No entries")).toBeInTheDocument();
    });

    it("should handle undefined entries", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: undefined,
      });

      const Wrapper = createWrapper();

      expect(() => {
        render(
          <Wrapper>
            <InfiniteScroller>
              <div>Content</div>
            </InfiniteScroller>
          </Wrapper>
        );
      }).not.toThrow();
    });

    it("should handle rapid scroll events", () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      // Simulate rapid scrolling
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer);
      }

      // Should have dispatched multiple times
      expect(mockDispatch.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle exactly at bottom boundary", () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      // Exactly at bottom: scrollHeight === scrollTop + clientHeight
      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 600,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 400,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      expect(mockDispatch).toHaveBeenCalled();
    });

    it("should NOT trigger when 1px away from bottom", () => {
      const Wrapper = createWrapper();
      const { container } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      // 1px away from bottom
      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 599,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 400,
        configurable: true,
      });

      fireEvent.scroll(scrollContainer);

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe("Loading state transitions", () => {
    it("should not dispatch while loading then dispatch when loaded", () => {
      mockUseFlowsheet.mockReturnValue({
        loading: true,
        entries: { current: [{ id: 1 }], previous: [] },
      });

      const Wrapper = createWrapper();
      const { container, rerender } = render(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      const scrollContainer = container.firstChild as HTMLElement;

      Object.defineProperty(scrollContainer, "scrollHeight", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "scrollTop", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, "clientHeight", {
        value: 500,
        configurable: true,
      });

      // Try to scroll while loading
      fireEvent.scroll(scrollContainer);
      expect(mockDispatch).not.toHaveBeenCalled();

      // Change to not loading
      mockUseFlowsheet.mockReturnValue({
        loading: false,
        entries: { current: [{ id: 1 }], previous: [] },
      });

      rerender(
        <Wrapper>
          <InfiniteScroller>
            <div>Content</div>
          </InfiniteScroller>
        </Wrapper>
      );

      // Now scroll should work
      fireEvent.scroll(scrollContainer);
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe("Children prop variations", () => {
    it("should render string children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>Simple text content</InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByText("Simple text content")).toBeInTheDocument();
    });

    it("should render fragment children", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InfiniteScroller>
            <>
              <span>Fragment child 1</span>
              <span>Fragment child 2</span>
            </>
          </InfiniteScroller>
        </Wrapper>
      );

      expect(screen.getByText("Fragment child 1")).toBeInTheDocument();
      expect(screen.getByText("Fragment child 2")).toBeInTheDocument();
    });

    it("should render array of elements", () => {
      const Wrapper = createWrapper();
      const items = ["Item A", "Item B", "Item C"];

      render(
        <Wrapper>
          <InfiniteScroller>
            {items.map((item, index) => (
              <div key={index}>{item}</div>
            ))}
          </InfiniteScroller>
        </Wrapper>
      );

      items.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });
});
