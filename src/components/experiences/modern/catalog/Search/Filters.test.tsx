import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Filters } from "./Filters";
import {
  createComponentHarnessWithQueries,
  componentQueries,
} from "@/lib/test-utils";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import type { ColorPaletteProp } from "@mui/joy";

const setup = createComponentHarnessWithQueries(
  Filters,
  { color: "primary" as ColorPaletteProp | undefined },
  {
    exclusiveCheckbox: componentQueries.byRole("checkbox", { name: "Exclusives Only" }),
  }
);

describe("Filters", () => {
  it("should render the Exclusives Only checkbox", () => {
    const { exclusiveCheckbox } = setup();

    expect(exclusiveCheckbox()).toBeInTheDocument();
  });

  it("should default exclusive checkbox to unchecked", () => {
    const { exclusiveCheckbox } = setup();

    expect(exclusiveCheckbox()).not.toBeChecked();
  });

  it("should toggle exclusive filter when checkbox is clicked", async () => {
    const { exclusiveCheckbox, user, getState } = setup();

    expect(catalogSlice.selectors.getExclusiveFilter(getState())).toBe(false);

    await user.click(exclusiveCheckbox());

    expect(exclusiveCheckbox()).toBeChecked();
    expect(catalogSlice.selectors.getExclusiveFilter(getState())).toBe(true);
  });

  it("should uncheck exclusive filter when clicked again", async () => {
    const { exclusiveCheckbox, user, getState } = setup();

    await user.click(exclusiveCheckbox());
    expect(catalogSlice.selectors.getExclusiveFilter(getState())).toBe(true);

    await user.click(exclusiveCheckbox());
    expect(exclusiveCheckbox()).not.toBeChecked();
    expect(catalogSlice.selectors.getExclusiveFilter(getState())).toBe(false);
  });

  it("should render Search In and Genre selects", () => {
    setup();

    expect(screen.getByText("Search In")).toBeInTheDocument();
    expect(screen.getByText("Genre")).toBeInTheDocument();
  });
});
