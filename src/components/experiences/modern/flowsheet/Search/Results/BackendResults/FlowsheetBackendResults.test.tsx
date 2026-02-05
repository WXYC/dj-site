import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowsheetBackendResults from "./FlowsheetBackendResults";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child component
vi.mock("./FlowsheetBackendResult", () => ({
  default: ({ entry, index }: any) => (
    <div data-testid="backend-result" data-index={index}>
      {entry.title}
    </div>
  ),
}));

describe("FlowsheetBackendResults", () => {
  const mockResults: AlbumEntry[] = [
    { id: 1, title: "Album One" } as AlbumEntry,
    { id: 2, title: "Album Two" } as AlbumEntry,
    { id: 3, title: "Album Three" } as AlbumEntry,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render label when results exist", () => {
    render(
      <FlowsheetBackendResults
        results={mockResults}
        offset={1}
        label="From Your Mail Bin"
      />
    );

    expect(screen.getByText("FROM YOUR MAIL BIN")).toBeInTheDocument();
  });

  it("should render results", () => {
    render(
      <FlowsheetBackendResults
        results={mockResults}
        offset={1}
        label="Test Label"
      />
    );

    expect(screen.getByText("Album One")).toBeInTheDocument();
    expect(screen.getByText("Album Two")).toBeInTheDocument();
    expect(screen.getByText("Album Three")).toBeInTheDocument();
  });

  it("should pass correct index to each result", () => {
    render(
      <FlowsheetBackendResults
        results={mockResults}
        offset={5}
        label="Test Label"
      />
    );

    const results = screen.getAllByTestId("backend-result");
    expect(results[0]).toHaveAttribute("data-index", "5");
    expect(results[1]).toHaveAttribute("data-index", "6");
    expect(results[2]).toHaveAttribute("data-index", "7");
  });

  it("should handle empty results", () => {
    const { container } = render(
      <FlowsheetBackendResults results={[]} offset={1} label="Empty Label" />
    );

    // Component renders but content is hidden
    expect(container.firstChild).not.toBeNull();
  });

  it("should uppercase the label", () => {
    render(
      <FlowsheetBackendResults
        results={mockResults}
        offset={1}
        label="from rotation"
      />
    );

    expect(screen.getByText("FROM ROTATION")).toBeInTheDocument();
  });
});
