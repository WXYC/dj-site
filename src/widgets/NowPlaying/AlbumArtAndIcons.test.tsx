import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";

// Mock useAlbumArtwork hook
const mockUseAlbumArtwork = vi.fn(
  (_artistName?: string, _releaseTitle?: string) => ({
    artworkUrl: "https://example.com/album-art.jpg",
    isLoading: false,
    metadata: null,
  }),
);

vi.mock("@/lib/features/metadata/hooks", () => ({
  useAlbumArtwork: (artistName?: string, releaseTitle?: string) =>
    mockUseAlbumArtwork(artistName, releaseTitle),
}));

// Mock MUI components - render children to allow img testing
vi.mock("@mui/joy", () => ({
  AspectRatio: ({ children, ...props }: any) => (
    <div data-testid="aspect-ratio" {...props}>
      {children}
    </div>
  ),
  Box: ({ children, ...props }: any) => (
    <div data-testid="box" {...props}>
      {children}
    </div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Timer: (props: any) => <span data-testid="timer-icon" {...props} />,
  Headphones: (props: any) => <span data-testid="headphones-icon" {...props} />,
  Logout: (props: any) => <span data-testid="logout-icon" {...props} />,
  Mic: (props: any) => <span data-testid="mic-icon" {...props} />,
}));

describe("AlbumArtAndIcons", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAlbumArtwork.mockReturnValue({
      artworkUrl: "https://example.com/album-art.jpg",
      isLoading: false,
      metadata: null,
    });
  });

  describe("when entry is undefined", () => {
    it("should render without crashing", () => {
      expect(() => render(<AlbumArtAndIcons entry={undefined} />)).not.toThrow();
    });

    it("should display aspect-ratio wrapper", () => {
      render(<AlbumArtAndIcons entry={undefined} />);
      expect(screen.getByTestId("aspect-ratio")).toBeInTheDocument();
    });

    it("should call useAlbumArtwork with undefined params", () => {
      render(<AlbumArtAndIcons entry={undefined} />);
      expect(mockUseAlbumArtwork).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe("when loading is true", () => {
    it("should display aspect-ratio wrapper while loading", () => {
      mockUseAlbumArtwork.mockReturnValue({
        artworkUrl: "https://example.com/album-art.jpg",
        isLoading: true,
        metadata: null,
      });

      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<AlbumArtAndIcons entry={songEntry} />);

      expect(screen.getByTestId("aspect-ratio")).toBeInTheDocument();
    });
  });

  describe("when entry is a song entry", () => {
    it("should call useAlbumArtwork with artist and album", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<AlbumArtAndIcons entry={songEntry} />);

      expect(mockUseAlbumArtwork).toHaveBeenCalledWith("Test Artist", "Test Album");
    });

    it("should render aspect-ratio wrapper", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<AlbumArtAndIcons entry={songEntry} />);

      expect(screen.getByTestId("aspect-ratio")).toBeInTheDocument();
    });
  });

  describe("when entry is a breakpoint entry", () => {
    it("should display Timer icon", () => {
      const breakpointEntry: FlowsheetBreakpointEntry = {
        ...baseEntry,
        message: "Breakpoint: Station ID",
        day: "Monday",
        time: "10:00",
      };

      render(<AlbumArtAndIcons entry={breakpointEntry} />);

      expect(screen.getByTestId("timer-icon")).toBeInTheDocument();
    });
  });

  describe("when entry is a start show entry", () => {
    it("should display Headphones icon", () => {
      const startShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      render(<AlbumArtAndIcons entry={startShowEntry} />);

      expect(screen.getByTestId("headphones-icon")).toBeInTheDocument();
    });
  });

  describe("when entry is an end show entry", () => {
    it("should display Logout icon", () => {
      const endShowEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        dj_name: "DJ Cool",
        isStart: false,
        day: "Monday",
        time: "22:00",
      };

      render(<AlbumArtAndIcons entry={endShowEntry} />);

      expect(screen.getByTestId("logout-icon")).toBeInTheDocument();
    });
  });

  describe("when entry is a talkset entry", () => {
    it("should display Mic icon", () => {
      const talksetEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "Talkset",
      };

      render(<AlbumArtAndIcons entry={talksetEntry} />);

      expect(screen.getByTestId("mic-icon")).toBeInTheDocument();
    });
  });

  describe("when entry is a generic message entry", () => {
    it("should render aspect ratio wrapper for fallback", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      render(<AlbumArtAndIcons entry={messageEntry} />);

      expect(screen.getByTestId("aspect-ratio")).toBeInTheDocument();
    });
  });

  describe("when entry is a non-song entry", () => {
    it("should call useAlbumArtwork with undefined params", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      render(<AlbumArtAndIcons entry={messageEntry} />);

      expect(mockUseAlbumArtwork).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
