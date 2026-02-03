import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Filters } from "./Filters";

const mockSetSearchIn = vi.fn();
const mockSetSearchGenre = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: () => ({
    setSearchIn: mockSetSearchIn,
    setSearchGenre: mockSetSearchGenre,
  }),
}));

describe("Filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render Search In label", () => {
    render(<Filters color="neutral" />);
    expect(screen.getByText("Search In")).toBeInTheDocument();
  });

  it("should render Genre label", () => {
    render(<Filters color="neutral" />);
    expect(screen.getByText("Genre")).toBeInTheDocument();
  });

  it("should render two select elements", () => {
    render(<Filters color="neutral" />);
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(2);
  });

  it("should render with undefined color", () => {
    render(<Filters color={undefined} />);
    expect(screen.getByText("Search In")).toBeInTheDocument();
    expect(screen.getByText("Genre")).toBeInTheDocument();
  });

  it("should render with success color", () => {
    const { container } = render(<Filters color="success" />);
    // Check that select elements have success color class
    const selects = container.querySelectorAll(".MuiSelect-root");
    expect(selects.length).toBe(2);
  });
});
