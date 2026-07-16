import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowsheetBackendResults from "@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResults";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child component
vi.mock("@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResult", () => ({
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

  it("caps rendering at 50 rows and shows a truncation footer for a huge response (#657)", () => {
    const many: AlbumEntry[] = Array.from(
      { length: 500 },
      (_, i) => ({ id: i + 1, title: `Album ${i + 1}` } as AlbumEntry)
    );

    render(
      <FlowsheetBackendResults results={many} offset={1} label="Card Catalog" />
    );

    expect(screen.getAllByTestId("backend-result")).toHaveLength(50);
    expect(
      screen.getByTestId("flowsheet-results-truncated")
    ).toBeInTheDocument();
  });

  it("renders all 50 rows and no footer at exactly the cap (#657 boundary)", () => {
    // Pins the strict > comparison: exactly 50 is NOT truncated.
    const fifty: AlbumEntry[] = Array.from(
      { length: 50 },
      (_, i) => ({ id: i + 1, title: `Album ${i + 1}` } as AlbumEntry)
    );

    render(
      <FlowsheetBackendResults results={fifty} offset={1} label="Card Catalog" />
    );

    expect(screen.getAllByTestId("backend-result")).toHaveLength(50);
    expect(
      screen.queryByTestId("flowsheet-results-truncated")
    ).not.toBeInTheDocument();
  });

  it("renders 50 rows plus the footer at one over the cap (#657 boundary)", () => {
    const fiftyOne: AlbumEntry[] = Array.from(
      { length: 51 },
      (_, i) => ({ id: i + 1, title: `Album ${i + 1}` } as AlbumEntry)
    );

    render(
      <FlowsheetBackendResults
        results={fiftyOne}
        offset={1}
        label="Card Catalog"
      />
    );

    expect(screen.getAllByTestId("backend-result")).toHaveLength(50);
    expect(
      screen.getByTestId("flowsheet-results-truncated")
    ).toBeInTheDocument();
  });

  it("renders all rows and no footer when under the cap (#657)", () => {
    const ten: AlbumEntry[] = Array.from(
      { length: 10 },
      (_, i) => ({ id: i + 1, title: `Album ${i + 1}` } as AlbumEntry)
    );

    render(
      <FlowsheetBackendResults results={ten} offset={1} label="Card Catalog" />
    );

    expect(screen.getAllByTestId("backend-result")).toHaveLength(10);
    expect(
      screen.queryByTestId("flowsheet-results-truncated")
    ).not.toBeInTheDocument();
  });
});
