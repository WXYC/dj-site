import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import SearchBar from "./SearchBar";
import { createComponentHarnessWithQueries } from "@/lib/test-utils";
import type { ColorPaletteProp } from "@mui/joy";

const setup = createComponentHarnessWithQueries(
  SearchBar,
  { color: "primary" as ColorPaletteProp | undefined },
  {
    input: () => screen.getByPlaceholderText("Search the catalog"),
  }
);

describe("SearchBar", () => {
  it("renders the query-builder input", () => {
    const { input } = setup();
    expect(input()).toBeInTheDocument();
  });

  it("renders the Genre and Format filter selects", () => {
    setup();
    expect(screen.getByText("Genre")).toBeInTheDocument();
    expect(screen.getByText("Format")).toBeInTheDocument();
  });

  it("renders the Exclusives Only checkbox", () => {
    setup();
    expect(screen.getByLabelText("Exclusives Only")).toBeInTheDocument();
  });
});
