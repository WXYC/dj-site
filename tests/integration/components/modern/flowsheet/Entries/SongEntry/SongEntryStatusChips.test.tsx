import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import SongEntryStatusChips from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntryStatusChips";
import { createTestFlowsheetEntry, renderWithProviders } from "@/tests/helpers";

// Modern shares only the exclusivity rule with classic, not its order or
// wording: classic's resolver prints ROTATION -> REQUEST -> EXCLUSIVE as
// "ROTATION H" / "REQUEST", while these chips run rotation -> EXCLUSIVE ->
// REQ -> SEGUE with a bare bin letter. This spec pins modern's own order and
// wording so a change to the shared rule cannot pull them toward classic's.
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

  // The converters collapse a null on_streaming (no linked library row) to
  // undefined, so "absent" is the null case as this component receives it.
  it.each<[string, boolean | undefined]>([
    ["true", true],
    ["absent", undefined],
  ])("does not badge EXCLUSIVE when on_streaming is %s", (_name, on_streaming) => {
    renderWithProviders(
      <SongEntryStatusChips
        entry={createTestFlowsheetEntry({ on_streaming })}
        editable={false}
      />
    );
    expect(screen.queryByText("EXCLUSIVE")).not.toBeInTheDocument();
  });
});
