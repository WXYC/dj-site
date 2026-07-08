import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import SmartFilters from "./SmartFilters";

describe("SmartFilters", () => {
  it("renders genre, format, and rotation filter controls", async () => {
    const { findByLabelText } = renderWithProviders(<SmartFilters />);
    expect(await findByLabelText("Genre")).toBeInTheDocument();
    expect(await findByLabelText("Format")).toBeInTheDocument();
    expect(await findByLabelText("Rotation")).toBeInTheDocument();
  });

  it("reflects a selected rotation-bin filter from the store", async () => {
    const { store, findByText } = renderWithProviders(<SmartFilters />);
    act(() => {
      store.dispatch(
        flowsheetSlice.actions.setSearchFilters({
          genres: [],
          formats: [],
          rotationTags: ["H"],
        })
      );
    });
    // getCatalogTagLabel("H") → "Heavy Rotation"
    expect(await findByText("Heavy Rotation")).toBeInTheDocument();
  });
});
