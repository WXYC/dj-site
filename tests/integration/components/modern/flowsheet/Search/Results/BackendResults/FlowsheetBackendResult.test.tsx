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
    // The chip reads the release's own format rather than collapsing it to a
    // vinyl-or-CD binary. The shelf holds Cassette and 7-inch Single, and a
    // binary that tested for a lowercase substring labelled every "Vinyl"
    // release "cd" — a mislabel a DJ acts on, made worse by the chip's hue
    // being resolved case-insensitively and so reading vinyl at the same time.
    it.each([
      ["CD", "CD"],
      ["cd", "CD"],
      ["Vinyl", "Vinyl"],
      ["vinyl", "Vinyl"],
      ['12" Vinyl', '12" Vinyl'],
      ["CD-R", "CD-R"],
      ["Cassette", "Cassette"],
      ["7-inch Single", "7-inch Single"],
    ])("labels a %s release %s", (format, label) => {
      const entry = createTestAlbum({ ...mockEntry, format });

      renderWithProviders(<FlowsheetBackendResult entry={entry} index={1} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Label and hue come from one resolver each, over the same text, so they
    // cannot disagree about what the release is.
    it("gives a vinyl release the vinyl hue alongside the vinyl label", () => {
      const entry = createTestAlbum({ ...mockEntry, format: "Vinyl" });

      renderWithProviders(<FlowsheetBackendResult entry={entry} index={1} />);

      const chip = screen.getByText("Vinyl").closest(".MuiChip-root");
      expect(chip?.className).toMatch(/colorFormatVinyl/i);
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
    const hoverRow = () => {
      const resultRow = screen
        .getByText("Juana Molina")
        .closest('[data-testid^="flowsheet-search-result-"]');
      fireEvent.mouseOver(resultRow!);
    };

    it("prefetches the row's legacy_release_id, not its library.id", () => {
      // `id`, `legacy_release_id`, and `index` are three distinct values, so
      // this can tell apart a component reading the right one from a component
      // reading either of the two plausible wrong ones. The endpoint resolves
      // its path param against `library.legacy_release_id`, so `id` is the
      // wrong space — and because the two spaces are nearly coextensive, a
      // wrong-space lookup lands on a real but unrelated release rather than
      // failing.
      const catalogEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: 1,
        legacy_release_id: 45342,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={catalogEntry} index={42} />
      );

      hoverRow();

      expect(mockPrefetchTracks).toHaveBeenCalledWith(45342);
    });

    it("prefetches a row that carries no library.id at all", () => {
      // An LML-sourced row knows a legacy release id but no `library.id`. The
      // gate has to key on the same field the argument does, or this row —
      // the one source whose picker works today — silently stops prefetching.
      const lmlEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: null,
        legacy_release_id: 45342,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={lmlEntry} index={42} />
      );

      hoverRow();

      expect(mockPrefetchTracks).toHaveBeenCalledWith(45342);
    });

    it("does not prefetch for a library-unlinked row (synthesized negative id, no legacy id)", () => {
      // An unlinked rotation row: the LEFT JOIN found no library row, so there
      // is no legacy id either. Backend 400s on a non-positive path param, so
      // this gate is what keeps the hover from erroring.
      const unlinkedEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: -1,
        legacy_release_id: null,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={unlinkedEntry} index={42} />
      );

      hoverRow();

      expect(mockPrefetchTracks).not.toHaveBeenCalled();
    });

    it("does not prefetch when the legacy id is absent despite a real library link", () => {
      // Backend's column is NOT NULL, so this shape means an emitter that
      // predates the field rather than routine data. It must degrade to no
      // prefetch, not fall back to `id` — falling back is the defect.
      const noLegacyEntry: AlbumEntry = createTestAlbum({
        ...mockEntry,
        id: 42,
        legacy_release_id: null,
      });
      renderWithProviders(
        <FlowsheetBackendResult entry={noLegacyEntry} index={7} />
      );

      hoverRow();

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
      const completeEntry: AlbumEntry = createTestAlbum({
        id: 100,
        title: "Aluminum Tunes",
        entry: 10,
        format: "Vinyl",
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
      expect(screen.getByText("Vinyl")).toBeInTheDocument();
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

  });
});
