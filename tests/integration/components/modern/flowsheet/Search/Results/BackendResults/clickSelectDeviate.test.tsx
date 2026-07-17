import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import {
  renderWithProviders,
  createTestAlbum,
  createTestArtist,
} from "@/tests/helpers";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import FlowsheetBackendResult from "@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResult";
import FlowsheetSearchInput from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchInput";

vi.mock("@/lib/features/metadata/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/features/metadata/api")>()),
  useMetadataPrefetch: () => vi.fn(),
}));

const binEntry = createTestAlbum({
  id: 42,
  title: "Aluminum Tunes",
  artist: createTestArtist({ name: "Stereolab" }),
  label: "Duophonic",
});

// The click-select/deviate contract, end to end through the real store:
// clicking a result freezes its linkage (the row reads as committed), and
// editing a filled field deviates — dropping the linkage/commit state.
describe("click-select then deviate", () => {
  it("clicking commits the row; editing a filled field deselects it", () => {
    const { store, rerender } = renderWithProviders(
      <>
        <FlowsheetBackendResult entry={binEntry} index={1} />
        <FlowsheetSearchInput name="artist" value="" deviates />
      </>
    );

    fireEvent.mouseDown(screen.getByTestId("flowsheet-search-result-1"));

    let query = flowsheetSlice.selectors.getSearchQuery(store.getState());
    expect(query.album_id).toBe(42);
    expect(query.artist).toBe("Stereolab");

    rerender(
      <>
        <FlowsheetBackendResult entry={binEntry} index={1} />
        <FlowsheetSearchInput
          name="artist"
          value={query.artist as string}
          deviates
        />
      </>
    );
    fireEvent.change(screen.getByTestId("flowsheet-search-artist"), {
      target: { value: "Stereolab X" },
    });

    query = flowsheetSlice.selectors.getSearchQuery(store.getState());
    expect(query.artist).toBe("Stereolab X");
    expect(query.album_id).toBeUndefined();
    expect(query.rotation_id).toBeUndefined();
    expect(query.rotation_bin).toBeUndefined();
  });
});
