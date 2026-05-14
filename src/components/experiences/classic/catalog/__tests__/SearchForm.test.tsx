import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(""),
}));

import SearchForm from "../SearchForm";

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
});
