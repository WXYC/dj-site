import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TableHeader from "./TableHeader";

const mockHandleRequestSort = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: () => ({
    orderBy: "title",
    orderDirection: "asc",
    handleRequestSort: mockHandleRequestSort,
  }),
}));

describe("TableHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render text value", () => {
    render(<TableHeader textValue="Title" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("should call handleRequestSort when clicked", () => {
    render(<TableHeader textValue="Artist" />);
    const element = screen.getByText("Artist");
    fireEvent.click(element);
    expect(mockHandleRequestSort).toHaveBeenCalledWith("Artist");
  });

  it("should show icon when orderBy matches column", () => {
    const { container } = render(<TableHeader textValue="title" />);
    // Check for presence of sort arrow icon
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("should render as MuiLink", () => {
    const { container } = render(<TableHeader textValue="Title" />);
    expect(container.querySelector(".MuiLink-root")).toBeInTheDocument();
  });
});
