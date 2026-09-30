import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import SongEntryStatusChips from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntryStatusChips";
import { createTestFlowsheetEntry, renderWithProviders } from "@/tests/helpers";

// Characterisation of the live chip order and wording, captured before the
// badge predicates moved to the shared indicators module. The shared resolver
// used by classic orders and labels these differently (ROTATION -> REQUEST ->
// EXCLUSIVE, "ROTATION H", "REQUEST"); this spec pins modern's own order and
// wording so the migration cannot drift them.
describe("SongEntryStatusChips", () => {
  it("renders no chips when no flags are set", () => {
    renderWithProviders(
      <SongEntryStatusChips entry={createTestFlowsheetEntry()} editable={false} />
    );
    expect(screen.queryByText("H")).not.toBeInTheDocument();
    expect(screen.queryByText("EXCLUSIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("REQ")).not.toBeInTheDocument();
    expect(screen.queryByText("SEGUE")).not.toBeInTheDocument();
  });

  it("renders rotation, exclusive, request and segue in that order on a non-editable row", () => {
    renderWithProviders(
      <SongEntryStatusChips
        entry={createTestFlowsheetEntry({
          rotation: "H",
          on_streaming: false,
          request_flag: true,
          segue: true,
        })}
        editable={false}
      />
    );
    const chips = screen.getAllByText(/^(H|EXCLUSIVE|REQ|SEGUE)$/);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "H",
      "EXCLUSIVE",
      "REQ",
      "SEGUE",
    ]);
    expect(screen.getByLabelText("Rotation H")).toBeInTheDocument();
  });

  it("hides request and segue on an editable row but keeps rotation and exclusive", () => {
    renderWithProviders(
      <SongEntryStatusChips
        entry={createTestFlowsheetEntry({
          rotation: "H",
          on_streaming: false,
          request_flag: true,
          segue: true,
        })}
        editable={true}
      />
    );
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("EXCLUSIVE")).toBeInTheDocument();
    expect(screen.queryByText("REQ")).not.toBeInTheDocument();
    expect(screen.queryByText("SEGUE")).not.toBeInTheDocument();
  });

  it("does not badge EXCLUSIVE when on_streaming is null (no linked library row)", () => {
    renderWithProviders(
      <SongEntryStatusChips
        entry={createTestFlowsheetEntry({ on_streaming: undefined })}
        editable={false}
      />
    );
    expect(screen.queryByText("EXCLUSIVE")).not.toBeInTheDocument();
  });
});
