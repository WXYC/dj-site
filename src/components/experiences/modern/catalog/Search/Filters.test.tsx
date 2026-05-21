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
    exclusiveCheckbox: componentQueries.byRole("checkbox", {
      name: "Exclusives Only",
    }),
  }
);

describe("Filters", () => {
  it("renders the Exclusives Only checkbox", () => {
    const { exclusiveCheckbox } = setup();
    expect(exclusiveCheckbox()).toBeInTheDocument();
  });

  it("defaults Exclusives Only to unchecked (onStreaming = undefined)", () => {
    const { exclusiveCheckbox, getState } = setup();
    expect(exclusiveCheckbox()).not.toBeChecked();
    expect(catalogSlice.selectors.getFilters(getState()).onStreaming).toBeUndefined();
  });

  it("toggles onStreaming filter when Exclusives Only is clicked", async () => {
    const { exclusiveCheckbox, user, getState } = setup();
    await user.click(exclusiveCheckbox());
    expect(exclusiveCheckbox()).toBeChecked();
    expect(catalogSlice.selectors.getFilters(getState()).onStreaming).toBe(false);

    await user.click(exclusiveCheckbox());
    expect(exclusiveCheckbox()).not.toBeChecked();
    expect(catalogSlice.selectors.getFilters(getState()).onStreaming).toBeUndefined();
  });

  it("renders Genre and Format selects (no Search In)", () => {
    setup();
    expect(screen.getByText("Genre")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
    expect(screen.queryByText("Search In")).not.toBeInTheDocument();
  });
});
