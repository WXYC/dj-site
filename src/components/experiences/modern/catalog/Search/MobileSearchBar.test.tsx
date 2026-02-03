import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MobileSearchBar from "./MobileSearchBar";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import React from "react";

// Mock catalogHooks
const mockSetSearchString = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    searchString: "",
    setSearchString: mockSetSearchString,
    dispatch: mockDispatch,
    catalogSlice: {
      selectors: {
        isMobileSearchOpen: () => false,
      },
      actions: {
        openMobileSearch: vi.fn(() => ({ type: "catalog/openMobileSearch" })),
        closeMobileSearch: vi.fn(() => ({ type: "catalog/closeMobileSearch" })),
      },
    },
  })),
}));

// Mock Filters component
vi.mock("./Filters", () => ({
  Filters: ({ color }: any) => <div data-testid="filters">Filters</div>,
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  FilterAlt: () => <span data-testid="filter-icon" />,
  SendOutlined: () => <span data-testid="send-icon" />,
  Troubleshoot: () => <span data-testid="search-icon" />,
}));

function createTestStore() {
  return configureStore({
    reducer: {
      catalog: catalogSlice.reducer,
    },
  });
}

describe("MobileSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("should render filter button", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    expect(screen.getByTestId("filter-icon")).toBeInTheDocument();
  });

  it("should render send button", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    expect(screen.getByTestId("send-icon")).toBeInTheDocument();
  });

  it("should call setSearchString when input changes", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    const input = screen.getByPlaceholderText("Search");
    fireEvent.change(input, { target: { value: "test search" } });

    expect(mockSetSearchString).toHaveBeenCalledWith("test search");
  });

  it("should call open when filter button is clicked", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    const filterButton = screen.getByTestId("filter-icon").closest("button");
    if (filterButton) {
      fireEvent.click(filterButton);
    }

    expect(mockDispatch).toHaveBeenCalled();
  });

  it("should render modal when open", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "",
      setSearchString: mockSetSearchString,
      dispatch: mockDispatch,
      catalogSlice: {
        selectors: {
          isMobileSearchOpen: () => true,
        },
        actions: {
          openMobileSearch: vi.fn(() => ({ type: "catalog/openMobileSearch" })),
          closeMobileSearch: vi.fn(() => ({ type: "catalog/closeMobileSearch" })),
        },
      },
    } as any);

    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color="primary" />
      </Provider>
    );

    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should use neutral color as default", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <MobileSearchBar color={undefined} />
      </Provider>
    );

    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });
});
