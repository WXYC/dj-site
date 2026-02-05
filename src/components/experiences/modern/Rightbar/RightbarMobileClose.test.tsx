import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RightbarMobileClose from "./RightbarMobileClose";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { applicationSlice } from "@/lib/features/application/frontend";

// Mock closeSidebarCSS utility
vi.mock("@/src/utilities/modern/catalog/utilities", () => ({
  closeSidebarCSS: vi.fn(),
}));

function createTestStore() {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });
}

describe("RightbarMobileClose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render overlay box", () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <RightbarMobileClose />
      </Provider>
    );

    const overlay = document.querySelector(".SecondSidebar-overlay");
    expect(overlay).toBeInTheDocument();
  });

  it("should dispatch closeSidebar action when clicked", async () => {
    const store = createTestStore();
    const dispatchSpy = vi.spyOn(store, "dispatch");

    render(
      <Provider store={store}>
        <RightbarMobileClose />
      </Provider>
    );

    const overlay = document.querySelector(".SecondSidebar-overlay");
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it("should call closeSidebarCSS when clicked", async () => {
    const { closeSidebarCSS } = await import(
      "@/src/utilities/modern/catalog/utilities"
    );
    const store = createTestStore();

    render(
      <Provider store={store}>
        <RightbarMobileClose />
      </Provider>
    );

    const overlay = document.querySelector(".SecondSidebar-overlay");
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(closeSidebarCSS).toHaveBeenCalled();
  });
});
