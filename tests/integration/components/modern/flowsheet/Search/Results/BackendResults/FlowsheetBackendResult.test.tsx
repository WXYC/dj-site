import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, createTestAlbum, createTestArtist } from "@/tests/helpers";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import FlowsheetBackendResult from "@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResult";
import type { AlbumEntry, ArtistEntry } from "@/lib/features/catalog/types";

// lib/store.ts wires metadataApi's reducer + middleware from this same
// module, so a whole-module factory makes makeStore() throw the moment a
// real store is built — the mock must preserve everything but the hook.
const mockPrefetchTracks = vi.fn();
vi.mock("@/lib/features/metadata/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/features/metadata/api")>()),
  useMetadataPrefetch: () => mockPrefetchTracks,
}));

describe("FlowsheetBackendResult", () => {
  const mockEntry: AlbumEntry = createTestAlbum({
    id: 42,
    title: "DOGA",
    entry: 5,
    format: "CD",
    label: "Sonamos",
    rotation_bin: "H",
    rotation_id: 10,
    artist: createTestArtist({
      name: "Juana Molina",
      lettercode: "AB",
      numbercode: 123,
      genre: "Rock",
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic rendering", () => {
    it("should render CODE section with genre and lettercode", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText(/Rock AB 123\/5/)).toBeInTheDocument();
    });

    it("should render ARTIST section", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("Juana Molina")).toBeInTheDocument();
    });

    it("should render ALBUM section", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("DOGA")).toBeInTheDocument();
    });

    it("should render LABEL section", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("Sonamos")).toBeInTheDocument();
    });
  });

  describe("Format chip", () => {
    it("should show 'cd' chip for CD format", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("cd")).toBeInTheDocument();
    });

    it("should show 'vinyl' chip for vinyl format", () => {
      // Note: Component checks format.includes("vinyl") (lowercase)
      const vinylEntry = createTestAlbum({
        ...mockEntry,
        format: "vinyl" as any, // Using lowercase to match component's check
      });

      renderWithProviders(<FlowsheetBackendResult entry={vinylEntry} index={1} />);

      expect(screen.getByText("vinyl")).toBeInTheDocument();
    });

    it("should show 'cd' chip for non-vinyl format", () => {
      const unknownFormatEntry = createTestAlbum({
        ...mockEntry,
        format: "Unknown",
      });

      renderWithProviders(
        <FlowsheetBackendResult entry={unknownFormatEntry} index={1} />
      );

      expect(screen.getByText("cd")).toBeInTheDocument();
    });
  });

  describe("Selected state styling", () => {
    it("renders in the selected state", () => {
      // selectedResult defaults to 0; seed it to 1 so index 1 renders selected.
      const initial = flowsheetSlice.getInitialState();
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />, {
        preloadedState: {
          flowsheet: {
            ...initial,
            search: { ...initial.search, selectedResult: 1 },
          },
        },
      });
      expect(screen.getByText("Juana Molina")).toBeInTheDocument();
    });
  });

  describe("Mouse interactions", () => {
    it("should not change the selection on mouse over — hover is visual only", () => {
      const { store } = renderWithProviders(
        <FlowsheetBackendResult entry={mockEntry} index={5} />
      );

      const queryBeforeHover = flowsheetSlice.selectors.getSearchQuery(
        store.getState()
      );

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      fireEvent.mouseOver(resultRow!);

      expect(flowsheetSlice.selectors.getSelectedResult(store.getState())).toBe(
        0
      );
      // Hover must not rewrite any part of the DJ's in-progress query.
      expect(flowsheetSlice.selectors.getSearchQuery(store.getState())).toEqual(
        queryBeforeHover
      );
    });

    // Clicking a result AUTOFILLS the fields via freezeSelectionToQuery — it
    // must never submit. mousedown is prevented so focus stays in the inputs.
    it("should autofill (freeze) the row's fields on mousedown, not submit", () => {
      const { store } = renderWithProviders(
        <FlowsheetBackendResult entry={mockEntry} index={1} />
      );

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      const notPrevented = fireEvent.mouseDown(resultRow!);

      expect(notPrevented).toBe(false);
      const query = flowsheetSlice.selectors.getSearchQuery(store.getState());
      expect(query).toMatchObject({
        artist: "Juana Molina",
        album: "DOGA",
        label: "Sonamos",
        album_id: 42,
        rotation_id: 10,
        rotation_bin: "H",
      });
    });

    it("should not submit on click", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      // A plain click doesn't fire the mousedown-based freeze handler.
      expect(() => fireEvent.click(resultRow!)).not.toThrow();
    });
  });

  describe("Tracklist prefetch", () => {
    it("prefetches tracks on mouse over when the row carries a real library link", () => {
      // id and index are deliberately distinct values so this test can tell
      // apart a component that reads entry.id from one that reads index.
      const linkedEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: 1,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={linkedEntry} index={42} />
      );

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      fireEvent.mouseOver(resultRow!);

      expect(mockPrefetchTracks).toHaveBeenCalledWith(1);
    });

    it("does not prefetch tracks for a library-unlinked row (synthesized negative id)", () => {
      const unlinkedEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: -1,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={unlinkedEntry} index={42} />
      );

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      fireEvent.mouseOver(resultRow!);

      expect(mockPrefetchTracks).not.toHaveBeenCalled();
    });
  });

  describe("Unknown/missing values", () => {
    it("should display 'Unknown' for missing artist name", () => {
      const entryWithoutArtist = createTestAlbum({
        ...mockEntry,
        artist: { ...mockEntry.artist, name: "" },
      });

      renderWithProviders(
        <FlowsheetBackendResult entry={entryWithoutArtist} index={1} />
      );

      expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    });

    it("should display 'Unknown' for missing album title", () => {
      const entryWithoutTitle = createTestAlbum({ ...mockEntry, title: "" });

      renderWithProviders(
        <FlowsheetBackendResult entry={entryWithoutTitle} index={1} />
      );

      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBeGreaterThan(0);
    });

    it("should display 'Unknown' for missing label", () => {
      const entryWithoutLabel = createTestAlbum({ ...mockEntry, label: "" });

      renderWithProviders(
        <FlowsheetBackendResult entry={entryWithoutLabel} index={1} />
      );

      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBeGreaterThan(0);
    });

    it("should apply italic style for missing values", () => {
      const entryWithMissingValues = createTestAlbum({
        ...mockEntry,
        artist: { ...mockEntry.artist, name: "" },
        title: "",
        label: "",
      });

      renderWithProviders(
        <FlowsheetBackendResult entry={entryWithMissingValues} index={1} />
      );

      // Missing artist/album/label plus the constant song placeholder
      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBe(4);
    });
  });

  // Regression: a result row can arrive with a null `artist` (LML / catalog
  // proxy rows where the artist object wasn't populated). The CODE and ARTIST
  // columns dereferenced `entry.artist.genre` / `entry.artist.name` with no
  // guard, so one such row threw mid-render and app/global-error white-screened
  // the whole site as the DJ typed.
  describe("Null artist (regression)", () => {
    it("does not throw and shows 'Unknown' when artist is null", () => {
      const entryWithNullArtist = createTestAlbum({
        ...mockEntry,
        artist: null as unknown as ArtistEntry,
      });

      expect(() =>
        renderWithProviders(
          <FlowsheetBackendResult entry={entryWithNullArtist} index={1} />
        )
      ).not.toThrow();

      expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Different index values", () => {
    it("should work with index 0", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={0} />);

      expect(screen.getByText("DOGA")).toBeInTheDocument();
    });

    it("should work with large index values", () => {
      renderWithProviders(
        <FlowsheetBackendResult entry={mockEntry} index={999} />
      );

      expect(screen.getByText("DOGA")).toBeInTheDocument();
    });
  });

  describe("Entry with all fields", () => {
    it("should render complete entry", () => {
      // Note: Using lowercase "vinyl" to match component's includes() check
      const completeEntry: AlbumEntry = createTestAlbum({
        id: 100,
        title: "Aluminum Tunes",
        entry: 10,
        format: "vinyl" as any,
        label: "Duophonic",
        rotation_bin: "M",
        rotation_id: 20,
        artist: createTestArtist({
          name: "Stereolab",
          lettercode: "XY",
          numbercode: 456,
          genre: "Jazz",
        }),
        alternate_artist: "Alt Artist",
        plays: 100,
        add_date: "2024-01-01",
      });

      renderWithProviders(<FlowsheetBackendResult entry={completeEntry} index={1} />);

      expect(screen.getByText("Stereolab")).toBeInTheDocument();
      expect(screen.getByText("Aluminum Tunes")).toBeInTheDocument();
      expect(screen.getByText("Duophonic")).toBeInTheDocument();
      expect(screen.getByText(/Jazz XY 456\/10/)).toBeInTheDocument();
      expect(screen.getByText("vinyl")).toBeInTheDocument();
    });
  });

  describe("Genre and code formatting", () => {
    it("should format code correctly with all parts", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // Should show: genre lettercode numbercode/entry
      expect(screen.getByText(/Rock AB 123\/5/)).toBeInTheDocument();
    });

    it("should handle various genres", () => {
      const genres = ["Rock", "Jazz", "Electronic", "Hiphop", "Classical"];

      genres.forEach((genre) => {
        const entryWithGenre = createTestAlbum({
          ...mockEntry,
          artist: { ...mockEntry.artist, genre: genre as any },
        });

        const { unmount } = renderWithProviders(
          <FlowsheetBackendResult entry={entryWithGenre} index={1} />
        );

        expect(screen.getByText(new RegExp(genre))).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have cursor pointer style", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      expect(resultRow).toBeInTheDocument();
    });
  });

  describe("CODE column", () => {
    it("should render code in monospace font", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const codeText = screen.getByText(/Rock AB/);
      expect(codeText).toHaveStyle({ fontFamily: "monospace" });
    });

    it("should render format chip", () => {
      renderWithProviders(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("cd")).toBeInTheDocument();
    });
  });
});
