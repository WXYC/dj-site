import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";

// Mock useAlbumImages hook
const mockSetAlbum = vi.fn();
const mockSetArtist = vi.fn();
const mockUseAlbumImages = vi.fn(() => ({
  setAlbum: mockSetAlbum,
  setArtist: mockSetArtist,
  loading: false,
  url: "https://example.com/album-art.jpg",
}));

vi.mock("@/src/hooks/applicationHooks", () => ({
  useAlbumImages: () => mockUseAlbumImages(),
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
    mockUseAlbumImages.mockReturnValue({
      setAlbum: mockSetAlbum,
      setArtist: mockSetArtist,
      loading: false,
      url: "https://example.com/album-art.jpg",
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
  });

  describe("when loading is true", () => {
    it("should display aspect-ratio wrapper while loading", () => {
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: true,
        url: "https://example.com/album-art.jpg",
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
    it("should call setAlbum and setArtist with entry data", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<AlbumArtAndIcons entry={songEntry} />);

      expect(mockSetAlbum).toHaveBeenCalledWith("Test Album");
      expect(mockSetArtist).toHaveBeenCalledWith("Test Artist");
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
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

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
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

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
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

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
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

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
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      render(<AlbumArtAndIcons entry={messageEntry} />);

      expect(screen.getByTestId("aspect-ratio")).toBeInTheDocument();
    });
  });

  describe("when entry changes from song to non-song", () => {
    it("should clear album and artist", () => {
      mockUseAlbumImages.mockReturnValue({
        setAlbum: mockSetAlbum,
        setArtist: mockSetArtist,
        loading: false,
        url: "",
      });

      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        message: "PSA: Community announcement",
      };

      render(<AlbumArtAndIcons entry={messageEntry} />);

      expect(mockSetAlbum).toHaveBeenCalledWith(undefined);
      expect(mockSetArtist).toHaveBeenCalledWith(undefined);
    });
  });
});
