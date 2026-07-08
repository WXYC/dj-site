import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { createTestFlowsheetQuery } from "@/lib/test-utils";
import type { SelectedMatch } from "@/lib/features/flowsheet/types";
import type { SmartResultGroup } from "./deriveSmartResults";
import SmartResults from "./SmartResults";

const groups: SmartResultGroup[] = [
  {
    key: "catalog",
    label: "Card catalog",
    entries: [
      createTestAlbum({ id: 1, title: "Dots and Loops", artist: createTestArtist({ name: "Stereolab" }) }),
      createTestAlbum({ id: 2, title: "Emperor Tomato Ketchup", artist: createTestArtist({ name: "Stereolab" }) }),
    ],
  },
];

const query = createTestFlowsheetQuery({ artist: "Stereo", album: "", label: "", song: "Percolator" });

const baseProps = {
  selectedMatch: null as SelectedMatch | null,
  groups,
  fieldOrder: ["artist" as const],
  query,
  highlightIndex: 0,
  onSelect: vi.fn(),
  onHover: vi.fn(),
  onRemoveMatch: vi.fn(),
};

describe("SmartResults", () => {
  it("renders group labels and a row per entry", () => {
    const { getByText, getAllByRole } = renderWithProviders(
      <SmartResults {...baseProps} />
    );
    expect(getByText("Card catalog")).toBeInTheDocument();
    expect(getAllByRole("option")).toHaveLength(2);
  });

  it("marks the highlighted row aria-selected", () => {
    const { getByTestId } = renderWithProviders(
      <SmartResults {...baseProps} highlightIndex={2} />
    );
    expect(getByTestId("flowsheet-search-result-2")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(getByTestId("flowsheet-search-result-1")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("selects a result on click", () => {
    const onSelect = vi.fn();
    const { getByTestId } = renderWithProviders(
      <SmartResults {...baseProps} onSelect={onSelect} />
    );
    fireEvent.mouseDown(getByTestId("flowsheet-search-result-1"));
    expect(onSelect).toHaveBeenCalledWith(groups[0].entries[0]);
  });

  it("renders the promoted Selected match with a remove control", () => {
    const selectedMatch: SelectedMatch = {
      id: 9,
      album_id: 9,
      artist: "Cat Power",
      album: "Moon Pix",
      label: "Matador",
    };
    const onRemoveMatch = vi.fn();
    const { getByText, getByLabelText } = renderWithProviders(
      <SmartResults {...baseProps} selectedMatch={selectedMatch} onRemoveMatch={onRemoveMatch} />
    );
    expect(getByText("Selected match")).toBeInTheDocument();
    fireEvent.mouseDown(getByLabelText("Remove selected match"));
    expect(onRemoveMatch).toHaveBeenCalled();
  });

  it("shows the empty hint when there is neither a match nor results", () => {
    const { getByText } = renderWithProviders(
      <SmartResults
        {...baseProps}
        groups={[]}
        emptyHint={<span>No matches</span>}
      />
    );
    expect(getByText("No matches")).toBeInTheDocument();
  });
});
