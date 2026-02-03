import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import AccountSearchForm from "./AccountSearchForm";
import { renderWithProviders } from "@/lib/test-utils";
import { adminSlice } from "@/lib/features/admin/frontend";

describe("AccountSearchForm", () => {
  it("should render search input", () => {
    renderWithProviders(<AccountSearchForm />);

    expect(screen.getByPlaceholderText("Search Roster")).toBeInTheDocument();
  });

  it("should not show clear button when search is empty", () => {
    renderWithProviders(<AccountSearchForm />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should update Redux state when typing", async () => {
    const { user, store } = renderWithProviders(<AccountSearchForm />);

    const input = screen.getByPlaceholderText("Search Roster");
    await user.type(input, "test search");

    expect(adminSlice.selectors.getSearchString(store.getState())).toBe("test search");
  });

  it("should show clear button when search has value", async () => {
    const { user } = renderWithProviders(<AccountSearchForm />);

    const input = screen.getByPlaceholderText("Search Roster");
    await user.type(input, "test");

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", async () => {
    const { user, store } = renderWithProviders(<AccountSearchForm />);

    const input = screen.getByPlaceholderText("Search Roster");
    await user.type(input, "test search");
    expect(adminSlice.selectors.getSearchString(store.getState())).toBe("test search");

    await user.click(screen.getByRole("button"));

    expect(adminSlice.selectors.getSearchString(store.getState())).toBe("");
    expect(input).toHaveValue("");
  });

  it("should have success color styling", () => {
    renderWithProviders(<AccountSearchForm />);

    const input = screen.getByPlaceholderText("Search Roster");
    expect(input.closest(".MuiInput-root")).toHaveClass("MuiInput-colorSuccess");
  });
});
