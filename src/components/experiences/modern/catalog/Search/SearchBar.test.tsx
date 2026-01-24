import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import SearchBar from "./SearchBar";
import {
  createComponentHarnessWithQueries,
  queryFactories,
} from "@/lib/test-utils";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const setup = createComponentHarnessWithQueries(
  SearchBar,
  { color: "primary" as const },
  {
    input: queryFactories.byPlaceholder("Search"),
    label: queryFactories.byText("Search for an album or artist"),
    clearButton: queryFactories.queryByRole("button", { name: "" }),
  }
);

describe("SearchBar", () => {
  it("should render the search input", () => {
    const { label, input } = setup();

    expect(label()).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
  });

  it("should not show clear button when search is empty", () => {
    const { input } = setup();

    expect(input()).toHaveValue("");

    const buttons = screen.queryAllByRole("button");
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute("aria-label", "clear");
    });
  });

  it("should display the search value from Redux store", async () => {
    const { input, user, getState } = setup();

    await user.type(input(), "Test Artist");

    expect(input()).toHaveValue("Test Artist");
    expect(catalogSlice.selectors.getSearchQuery(getState())).toBe("Test Artist");
  });

  it("should show clear button when search has value", async () => {
    const { input, clearButton, user } = setup();

    await user.type(input(), "Test");

    expect(clearButton()).toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", async () => {
    const { input, clearButton, user, getState } = setup();

    await user.type(input(), "Test Artist");
    expect(input()).toHaveValue("Test Artist");

    await user.click(clearButton()!);

    expect(input()).toHaveValue("");
    expect(catalogSlice.selectors.getSearchQuery(getState())).toBe("");
  });

  it.each([
    { color: "primary" },
    { color: "success" },
    { color: "neutral" },
    { color: undefined },
  ] as const)("should render with color=$color", (props) => {
    const { input } = setup(props as { color?: "primary" });
    expect(input()).toBeInTheDocument();
  });
});
