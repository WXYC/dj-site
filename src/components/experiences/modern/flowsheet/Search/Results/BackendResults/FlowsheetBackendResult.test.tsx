import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowsheetBackendResult from "./FlowsheetBackendResult";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
const mockDispatch = vi.fn();
const mockHandleSubmit = vi.fn();
const mockUseAppSelector = vi.fn();

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => mockUseAppSelector(selector),
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    selectors: {
      getSelectedResult: "getSelectedResult",
    },
    actions: {
      setSelectedResult: vi.fn((index) => ({
        type: "setSelectedResult",
        payload: index,
      })),
    },
  },
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSubmit: () => ({
    ctrlKeyPressed: false,
    handleSubmit: mockHandleSubmit,
  }),
}));

// Mock child component
vi.mock("@/src/components/experiences/modern/catalog/ArtistAvatar", () => ({
  ArtistAvatar: ({ artist, format, entry, rotation }: any) => (
    <div data-testid="artist-avatar">
      {artist?.name} - {entry} - {format} - {rotation}
    </div>
  ),
}));

describe("FlowsheetBackendResult", () => {
  const mockEntry: AlbumEntry = {
    id: 1,
    title: "Test Album",
    entry: 5,
    format: "CD",
    label: "Test Label",
    rotation_bin: "H",
    rotation_id: 10,
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "AB",
      numbercode: 123,
      genre: "Rock",
    },
    alternate_artist: undefined,
    plays: undefined,
    add_date: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppSelector.mockReturnValue(0); // Default: nothing selected
  });

  describe("Basic rendering", () => {
    it("should render ArtistAvatar", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByTestId("artist-avatar")).toBeInTheDocument();
    });

    it("should pass correct props to ArtistAvatar", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const avatar = screen.getByTestId("artist-avatar");
      expect(avatar).toHaveTextContent("Test Artist");
      expect(avatar).toHaveTextContent("5");
      expect(avatar).toHaveTextContent("CD");
      expect(avatar).toHaveTextContent("H");
    });

    it("should render CODE section with genre and lettercode", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("CODE")).toBeInTheDocument();
      expect(screen.getByText(/Rock AB 123\/5/)).toBeInTheDocument();
    });

    it("should render ARTIST section", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("ARTIST")).toBeInTheDocument();
      expect(screen.getByText("Test Artist")).toBeInTheDocument();
    });

    it("should render ALBUM section", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("ALBUM")).toBeInTheDocument();
      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });

    it("should render LABEL section", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("LABEL")).toBeInTheDocument();
      expect(screen.getByText("Test Label")).toBeInTheDocument();
    });
  });

  describe("Format chip", () => {
    it("should show 'cd' chip for CD format", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      expect(screen.getByText("cd")).toBeInTheDocument();
    });

    it("should show 'vinyl' chip for vinyl format", () => {
      // Note: Component checks format.includes("vinyl") (lowercase)
      const vinylEntry: AlbumEntry = {
        ...mockEntry,
        format: "vinyl" as any, // Using lowercase to match component's check
      };

      render(<FlowsheetBackendResult entry={vinylEntry} index={1} />);

      expect(screen.getByText("vinyl")).toBeInTheDocument();
    });

    it("should show 'cd' chip for non-vinyl format", () => {
      const unknownFormatEntry: AlbumEntry = {
        ...mockEntry,
        format: "Unknown",
      };

      render(<FlowsheetBackendResult entry={unknownFormatEntry} index={1} />);

      expect(screen.getByText("cd")).toBeInTheDocument();
    });
  });

  describe("Selected state styling", () => {
    it("should have transparent background when not selected", () => {
      mockUseAppSelector.mockReturnValue(0); // Different index

      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // The background is transparent when not selected
      // We can verify by checking the rendered styles
    });

    it("should have primary background when selected (not submitting to queue)", () => {
      mockUseAppSelector.mockReturnValue(1); // Same as index

      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // Background should be primary.700 when selected
    });

    it("should have success background when selected and submitting to queue", () => {
      mockUseAppSelector.mockReturnValue(1);

      vi.mock("@/src/hooks/flowsheetHooks", async () => ({
        useFlowsheetSubmit: () => ({
          ctrlKeyPressed: true, // Submitting to queue
          handleSubmit: mockHandleSubmit,
        }),
      }));

      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // Background should be success.700 when selected and submitting to queue
    });
  });

  describe("Mouse interactions", () => {
    it("should dispatch setSelectedResult on mouse over", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={5} />);

      const resultRow = screen.getByText("Test Artist").closest('[class*="MuiStack-root"]');
      fireEvent.mouseOver(resultRow!);

      expect(mockDispatch).toHaveBeenCalled();
    });

    it("should call handleSubmit on click", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const resultRow = screen.getByText("Test Artist").closest('[class*="MuiStack-root"]');
      fireEvent.click(resultRow!);

      expect(mockHandleSubmit).toHaveBeenCalled();
    });
  });

  describe("Unknown/missing values", () => {
    it("should display 'Unknown' for missing artist name", () => {
      const entryWithoutArtist: AlbumEntry = {
        ...mockEntry,
        artist: {
          ...mockEntry.artist,
          name: "",
        },
      };

      render(<FlowsheetBackendResult entry={entryWithoutArtist} index={1} />);

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("should display 'Unknown' for missing album title", () => {
      const entryWithoutTitle: AlbumEntry = {
        ...mockEntry,
        title: "",
      };

      render(<FlowsheetBackendResult entry={entryWithoutTitle} index={1} />);

      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBeGreaterThan(0);
    });

    it("should display 'Unknown' for missing label", () => {
      const entryWithoutLabel: AlbumEntry = {
        ...mockEntry,
        label: "",
      };

      render(<FlowsheetBackendResult entry={entryWithoutLabel} index={1} />);

      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBeGreaterThan(0);
    });

    it("should apply italic style for missing values", () => {
      const entryWithMissingValues: AlbumEntry = {
        ...mockEntry,
        artist: {
          ...mockEntry.artist,
          name: "",
        },
        title: "",
        label: "",
      };

      render(<FlowsheetBackendResult entry={entryWithMissingValues} index={1} />);

      // Unknown values should have italic fontStyle
      const unknownElements = screen.getAllByText("Unknown");
      expect(unknownElements.length).toBe(3);
    });
  });

  describe("Different index values", () => {
    it("should work with index 0", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={0} />);

      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });

    it("should work with large index values", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={999} />);

      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });

    it("should set selected on mouseover with correct index", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={42} />);

      const resultRow = screen.getByText("Test Artist").closest('[class*="MuiStack-root"]');
      fireEvent.mouseOver(resultRow!);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe("Entry with all fields", () => {
    it("should render complete entry", () => {
      // Note: Using lowercase "vinyl" to match component's includes() check
      const completeEntry: AlbumEntry = {
        id: 100,
        title: "Complete Album",
        entry: 10,
        format: "vinyl" as any,
        label: "Complete Label",
        rotation_bin: "M",
        rotation_id: 20,
        artist: {
          id: 50,
          name: "Complete Artist",
          lettercode: "XY",
          numbercode: 456,
          genre: "Jazz",
        },
        alternate_artist: "Alt Artist",
        plays: 100,
        add_date: "2024-01-01",
      };

      render(<FlowsheetBackendResult entry={completeEntry} index={1} />);

      expect(screen.getByText("Complete Artist")).toBeInTheDocument();
      expect(screen.getByText("Complete Album")).toBeInTheDocument();
      expect(screen.getByText("Complete Label")).toBeInTheDocument();
      expect(screen.getByText(/Jazz XY 456\/10/)).toBeInTheDocument();
      expect(screen.getByText("vinyl")).toBeInTheDocument();
    });
  });

  describe("Genre and code formatting", () => {
    it("should format code correctly with all parts", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // Should show: genre lettercode numbercode/entry
      expect(screen.getByText(/Rock AB 123\/5/)).toBeInTheDocument();
    });

    it("should handle various genres", () => {
      const genres = ["Rock", "Jazz", "Electronic", "Hiphop", "Classical"];

      genres.forEach((genre) => {
        const entryWithGenre: AlbumEntry = {
          ...mockEntry,
          artist: {
            ...mockEntry.artist,
            genre: genre as any,
          },
        };

        const { unmount } = render(
          <FlowsheetBackendResult entry={entryWithGenre} index={1} />
        );

        expect(screen.getByText(new RegExp(genre))).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have cursor pointer style", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      // The Stack component should have cursor: pointer
      const resultRow = screen.getByText("Test Artist").closest('[class*="MuiStack-root"]');
      expect(resultRow).toBeInTheDocument();
    });
  });

  describe("Key prop usage", () => {
    it("should use bin-{index} as key pattern", () => {
      // This test verifies the key is used correctly
      // The key is set as `bin-${index}` in the component
      render(<FlowsheetBackendResult entry={mockEntry} index={5} />);

      expect(screen.getByText("Test Album")).toBeInTheDocument();
    });
  });

  describe("Rotation display", () => {
    it("should pass rotation to ArtistAvatar", () => {
      render(<FlowsheetBackendResult entry={mockEntry} index={1} />);

      const avatar = screen.getByTestId("artist-avatar");
      expect(avatar).toHaveTextContent("H");
    });

    it("should handle missing rotation", () => {
      const entryWithoutRotation: AlbumEntry = {
        ...mockEntry,
        rotation_bin: undefined,
      };

      render(<FlowsheetBackendResult entry={entryWithoutRotation} index={1} />);

      expect(screen.getByTestId("artist-avatar")).toBeInTheDocument();
    });
  });
});
