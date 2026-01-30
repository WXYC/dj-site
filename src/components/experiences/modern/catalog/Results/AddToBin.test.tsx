import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AddToBin from "./AddToBin";

const mockAddToBin = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useAddToBin: () => ({
    addToBin: mockAddToBin,
    loading: false,
  }),
}));

const mockAlbum = {
  id: 1,
  title: "Test Album",
  artist: { name: "Test Artist", lettercode: "TA", numbercode: 1, genre: "Rock" },
  entry: 42,
  format: "CD",
  label: "Test Label",
  add_date: "2024-01-01",
  plays: 0,
};

describe("AddToBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<AddToBin album={mockAlbum} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call addToBin when clicked", () => {
    render(<AddToBin album={mockAlbum} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockAddToBin).toHaveBeenCalledWith(1);
  });

  it("should render Archive icon", () => {
    const { container } = render(<AddToBin album={mockAlbum} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("should pass additional props to IconButton", () => {
    render(<AddToBin album={mockAlbum} color="success" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-colorSuccess");
  });
});
