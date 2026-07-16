import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import SearchBar from "./SearchBar";
import { createComponentHarnessWithQueries } from "@/tests/helpers";
import type { ColorPaletteProp } from "@mui/joy";

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetGenresQuery: vi.fn(() => ({
      data: [{ id: 1, genre_name: "Rock" }],
      isLoading: false,
    })),
    useGetFormatsQuery: vi.fn(() => ({
      data: [{ id: 1, format_name: "cd" }],
      isLoading: false,
    })),
  };
});

const setup = createComponentHarnessWithQueries(
  SearchBar,
  { color: "primary" as ColorPaletteProp | undefined },
  {
    input: () => screen.getByTestId("catalog-search-input"),
  },
);

describe("SearchBar", () => {
  it("renders the query-builder input", () => {
    const { input } = setup();
    expect(input()).toBeInTheDocument();
  });

  it("renders filters in the attached gutter", () => {
    setup();
    expect(screen.getByTestId("catalog-search-filters")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tag" })).toBeInTheDocument();
  });
});
