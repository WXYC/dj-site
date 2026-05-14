import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import SearchForm from "../SearchForm";

beforeEach(() => {
  mockPush.mockClear();
  mockSearchParams = new URLSearchParams("");
});

describe("Classic catalog SearchForm — Browse Exclusive Albums", () => {
  it("renders a 'Browse Exclusive Albums' button", () => {
    renderWithProviders(<SearchForm />);
    expect(
      screen.getByRole("button", { name: /browse exclusive albums/i })
    ).toBeDefined();
  });

  it("clicking the button sets the exclusive filter and navigates to ?exclusive=true", async () => {
    mockPush.mockClear();
    const { user, store } = renderWithProviders(<SearchForm />);
    const button = screen.getByRole("button", {
      name: /browse exclusive albums/i,
    });
    await user.click(button);
    expect(
      catalogSlice.selectors.getExclusiveFilter(store.getState())
    ).toBe(true);
    expect(mockPush).toHaveBeenCalledWith(
      "/dashboard/catalog?exclusive=true"
    );
  });

  it("clears the search query when entering exclusive-browse mode", async () => {
    const { user, store } = renderWithProviders(<SearchForm />);
    store.dispatch(catalogSlice.actions.setSearchQuery("polvo"));
    await user.click(
      screen.getByRole("button", { name: /browse exclusive albums/i })
    );
    expect(
      catalogSlice.selectors.getSearchQuery(store.getState())
    ).toBe("");
  });

  it("rehydrates the Exclusive filter from ?exclusive=true on mount", () => {
    mockSearchParams = new URLSearchParams("exclusive=true");
    const { store } = renderWithProviders(<SearchForm />);
    expect(
      catalogSlice.selectors.getExclusiveFilter(store.getState())
    ).toBe(true);
  });

  it("does NOT touch the Exclusive filter when ?exclusive is absent", () => {
    const { store } = renderWithProviders(<SearchForm />);
    expect(
      catalogSlice.selectors.getExclusiveFilter(store.getState())
    ).toBe(false);
  });

  it("preserves ?exclusive=true on submit when the Exclusive filter is on", async () => {
    mockPush.mockClear();
    const { user, store } = renderWithProviders(<SearchForm />);
    store.dispatch(catalogSlice.actions.setExclusiveFilter(true));
    const input = screen.getByRole("textbox");
    await user.type(input, "polvo");
    const submit = screen.getByRole("button", {
      name: /search the wxyc library/i,
    });
    await user.click(submit);
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("searchString=polvo");
    expect(pushedUrl).toContain("exclusive=true");
  });

  it("omits exclusive=true on submit when the Exclusive filter is off", async () => {
    mockPush.mockClear();
    const { user } = renderWithProviders(<SearchForm />);
    const input = screen.getByRole("textbox");
    await user.type(input, "polvo");
    const submit = screen.getByRole("button", {
      name: /search the wxyc library/i,
    });
    await user.click(submit);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("searchString=polvo");
    expect(pushedUrl).not.toContain("exclusive=true");
  });
});
