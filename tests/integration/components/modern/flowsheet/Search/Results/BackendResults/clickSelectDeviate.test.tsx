import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import FlowsheetBackendResult from "@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResult";
import FlowsheetSearchInput from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchInput";
import type { AlbumEntry } from "@/lib/features/catalog/types";

vi.mock("@/lib/features/metadata/api", () => ({
  useMetadataPrefetch: () => vi.fn(),
}));

const binEntry: AlbumEntry = {
  id: 42,
  title: "Aluminum Tunes",
  entry: 3,
  format: "CD",
  label: "Duophonic",
  rotation_bin: undefined,
  rotation_id: undefined,
  artist: {
    id: 1,
    name: "Stereolab",
    lettercode: "ST",
    numbercode: 55,
    genre: "Rock",
  },
  alternate_artist: undefined,
  plays: undefined,
  add_date: undefined,
} as AlbumEntry;

function createStore() {
  return configureStore({
    reducer: { flowsheet: flowsheetSlice.reducer },
  });
}

// The click-select/deviate contract, end to end through the real store:
// clicking a result freezes its linkage (the row reads as committed), and
// editing a filled field deviates — dropping the linkage/commit state.
describe("click-select then deviate", () => {
  it("clicking commits the row; editing a filled field deselects it", () => {
    const store = createStore();

    const Harness = () => {
      const artistValue = flowsheetSlice.selectors.getSearchQuery(
        store.getState()
      ).artist;
      return (
        <Provider store={store}>
          <FlowsheetBackendResult entry={binEntry} index={1} />
          <FlowsheetSearchInput
            name="artist"
            value={artistValue as string}
            deviates
          />
        </Provider>
      );
    };

    const { rerender } = render(<Harness />);

    fireEvent.mouseDown(screen.getByTestId("flowsheet-search-result-1"));

    let query = flowsheetSlice.selectors.getSearchQuery(store.getState());
    expect(query.album_id).toBe(42);
    expect(query.artist).toBe("Stereolab");

    rerender(<Harness />);
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
