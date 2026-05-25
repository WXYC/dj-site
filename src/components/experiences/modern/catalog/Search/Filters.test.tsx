import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { Filters } from "./Filters";
import { createComponentHarnessWithQueries } from "@/lib/test-utils";
import { catalogSlice } from "@/lib/features/catalog/frontend";

const mockGenres = [
  { id: 1, genre_name: "Rock" },
  { id: 2, genre_name: "Jazz" },
];

const mockFormats = [
  { id: 1, format_name: "cd" },
  { id: 2, format_name: "Vinyl" },
];

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetGenresQuery: vi.fn(() => ({
      data: mockGenres,
      isLoading: false,
    })),
    useGetFormatsQuery: vi.fn(() => ({
      data: mockFormats,
      isLoading: false,
    })),
  };
});

const setup = createComponentHarnessWithQueries(
  Filters,
  {},
  {
    tagInput: () => screen.getByRole("combobox", { name: "Tag" }),
    genreInput: () => screen.getByRole("combobox", { name: "Genre" }),
    formatInput: () => screen.getByRole("combobox", { name: "Format" }),
    gutter: () => screen.getByTestId("catalog-search-filters"),
  },
);

describe("Filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders three sections separated by vertical dividers", () => {
    const { gutter } = setup();
    expect(gutter().querySelectorAll("hr")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Genre" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tag" })).toBeInTheDocument();
  });

  it("does not render section header labels", () => {
    setup();
    expect(screen.queryByText("Genres")).not.toBeInTheDocument();
    expect(screen.queryByText("Formats")).not.toBeInTheDocument();
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });

  it("shows tag autocomplete placeholder when empty", () => {
    const { tagInput } = setup();
    expect(tagInput()).toHaveAttribute("placeholder", "All tags...");
  });

  it("defaults tags to empty", () => {
    const { getState } = setup();
    expect(catalogSlice.selectors.getFilters(getState()).tags).toEqual([]);
  });

  it("selects exclusives via tag autocomplete", async () => {
    const { tagInput, user, getState } = setup();
    await user.click(tagInput());
    await user.click(await screen.findByRole("option", { name: "exclusives" }));
    expect(catalogSlice.selectors.getFilters(getState()).tags).toEqual([
      "exclusives",
    ]);
  });

  it("selects missing via tag autocomplete", async () => {
    const { tagInput, user, getState } = setup();
    await user.click(tagInput());
    await user.click(await screen.findByRole("option", { name: "missing" }));
    expect(catalogSlice.selectors.getFilters(getState()).tags).toEqual([
      "missing",
    ]);
  });

  it("selects heavy rotation via tag autocomplete", async () => {
    const { tagInput, user, getState } = setup();
    await user.click(tagInput());
    await user.click(
      await screen.findByRole("option", { name: "Heavy Rotation" }),
    );
    expect(catalogSlice.selectors.getFilters(getState()).tags).toEqual(["H"]);
  });

  it("shows genre and format autocomplete placeholders when empty", () => {
    const { genreInput, formatInput } = setup();
    expect(genreInput()).toHaveAttribute("placeholder", "All genres...");
    expect(formatInput()).toHaveAttribute("placeholder", "All formats...");
  });

  it("selects multiple genres via autocomplete", async () => {
    const { genreInput, user, getState } = setup();
    await user.click(genreInput());
    await user.click(await screen.findByRole("option", { name: "Rock" }));
    await user.click(await screen.findByRole("option", { name: "Jazz" }));
    expect(catalogSlice.selectors.getFilters(getState()).genres).toEqual([
      "Rock",
      "Jazz",
    ]);
  });

  it("selects formats via autocomplete", async () => {
    const { formatInput, user, getState } = setup();
    await user.click(formatInput());
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByRole("option", { name: "cd" }));
    expect(catalogSlice.selectors.getFilters(getState()).formats).toEqual(["cd"]);
  });
});
