import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import InfiniteScroller from "./InfiniteScroller";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import React from "react";

// Mock flowsheet hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: vi.fn(() => ({
    loading: false,
    entries: {
      current: [],
      previous: [],
    },
  })),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      flowsheet: flowsheetSlice.reducer,
    },
  });
}

function createWrapper() {
  const store = createTestStore();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("InfiniteScroller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
});
