import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NowPlaying from "./index";
import type {
  FlowsheetSongEntry,
  OnAirDJResponse,
  OnAirDJData,
} from "@/lib/features/flowsheet/types";

// Mock the API hooks
const mockUseWhoIsLiveQuery = vi.fn();
const mockUseGetNowPlayingQuery = vi.fn();

vi.mock("@/lib/features/flowsheet/api", () => ({
  useGetNowPlayingQuery: (arg: any, options: any) =>
    mockUseGetNowPlayingQuery(arg, options),
  useWhoIsLiveQuery: () => mockUseWhoIsLiveQuery(),
}));

// Mock the useAlbumImages hook
vi.mock("@/src/hooks/applicationHooks", () => ({
  useAlbumImages: () => ({
    setAlbum: vi.fn(),
    setArtist: vi.fn(),
    loading: false,
    url: "https://example.com/album.jpg",
  }),
}));

// Mock NowPlayingMain component
vi.mock("./Main", () => ({
  default: ({
    entry,
    live,
    onAirDJ,
    loading,
  }: {
    entry?: any;
    live: boolean;
    onAirDJ?: string;
    loading?: boolean;
  }) => (
    <div
      data-testid="now-playing-main"
      data-has-entry={entry !== undefined}
      data-entry-id={entry?.id}
      data-live={live}
      data-on-air-dj={onAirDJ || ""}
      data-loading={loading}
    />
  ),
}));

// Mock NowPlayingMini component
vi.mock("./Mini", () => ({
  default: ({
    entry,
    live,
    onAirDJs,
  }: {
    entry?: any;
    live: boolean;
    onAirDJs?: OnAirDJResponse[];
  }) => (
    <div
      data-testid="now-playing-mini"
      data-has-entry={entry !== undefined}
      data-entry-id={entry?.id}
      data-live={live}
      data-djs-count={onAirDJs?.length || 0}
    />
  ),
}));

describe("NowPlaying", () => {
  const mockSongEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
    track_title: "Test Track",
    artist_name: "Test Artist",
    album_title: "Test Album",
    record_label: "Test Label",
    request_flag: false,
  };

  const mockDJsOnAirData: OnAirDJData = {
    onAir: "DJ Cool",
    djs: [{ id: "1", dj_name: "DJ Cool" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    mockUseWhoIsLiveQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    mockUseGetNowPlayingQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<NowPlaying mini={false} />)).not.toThrow();
    });

    it("should render NowPlayingMain when mini is false", () => {
      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toBeInTheDocument();
      expect(screen.queryByTestId("now-playing-mini")).not.toBeInTheDocument();
    });

    it("should render NowPlayingMini when mini is true", () => {
      render(<NowPlaying mini={true} />);
      expect(screen.getByTestId("now-playing-mini")).toBeInTheDocument();
      expect(screen.queryByTestId("now-playing-main")).not.toBeInTheDocument();
    });

    it("should render audio element", () => {
      const { container } = render(<NowPlaying mini={false} />);
      const audio = container.querySelector("audio#now-playing-music");
      expect(audio).toBeInTheDocument();
    });

    it("should set crossOrigin on audio element", () => {
      const { container } = render(<NowPlaying mini={false} />);
      const audio = container.querySelector("audio");
      expect(audio).toHaveAttribute("crossOrigin", "anonymous");
    });
  });

  describe("live status logic", () => {
    it("should be live when onAir is a DJ name (not Off Air)", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "true"
      );
    });

    it("should not be live when onAir is Off Air", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { onAir: "Off Air", djs: [] },
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });

    it("should not be live when onAir is undefined", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { onAir: undefined, djs: [] },
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });

    it("should not be live when djError is true", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: true,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });

    it("should not be live when data is undefined", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });
  });

  describe("loading state", () => {
    it("should pass loading to NowPlayingMain when djLoading is true", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-loading",
        "true"
      );
    });

    it("should pass loading=false when not loading", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-loading",
        "false"
      );
    });
  });

  describe("entry data", () => {
    it("should pass entry to NowPlayingMain", () => {
      mockUseGetNowPlayingQuery.mockReturnValue({
        data: mockSongEntry,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      const main = screen.getByTestId("now-playing-main");
      expect(main).toHaveAttribute("data-has-entry", "true");
      expect(main).toHaveAttribute("data-entry-id", "1");
    });

    it("should pass entry to NowPlayingMini", () => {
      mockUseGetNowPlayingQuery.mockReturnValue({
        data: mockSongEntry,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={true} />);
      const mini = screen.getByTestId("now-playing-mini");
      expect(mini).toHaveAttribute("data-has-entry", "true");
      expect(mini).toHaveAttribute("data-entry-id", "1");
    });

    it("should pass undefined entry when no data", () => {
      mockUseGetNowPlayingQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-has-entry",
        "false"
      );
    });
  });

  describe("DJ data", () => {
    it("should pass onAirDJ to NowPlayingMain", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-on-air-dj",
        "DJ Cool"
      );
    });

    it("should pass onAirDJs to NowPlayingMini", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={true} />);
      expect(screen.getByTestId("now-playing-mini")).toHaveAttribute(
        "data-djs-count",
        "1"
      );
    });

    it("should pass empty onAirDJ when data is undefined", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-on-air-dj",
        ""
      );
    });

    it("should pass zero djs when data is undefined", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={true} />);
      expect(screen.getByTestId("now-playing-mini")).toHaveAttribute(
        "data-djs-count",
        "0"
      );
    });
  });

  describe("API polling", () => {
    it("should call useGetNowPlayingQuery with pollingInterval", () => {
      render(<NowPlaying mini={false} />);
      expect(mockUseGetNowPlayingQuery).toHaveBeenCalledWith(undefined, {
        pollingInterval: 60000,
      });
    });
  });

  describe("multiple DJs", () => {
    it("should pass multiple DJs to NowPlayingMini", () => {
      const multipleDJs: OnAirDJData = {
        onAir: "DJ Cool & DJ Hot",
        djs: [
          { id: "1", dj_name: "DJ Cool" },
          { id: "2", dj_name: "DJ Hot" },
        ],
      };

      mockUseWhoIsLiveQuery.mockReturnValue({
        data: multipleDJs,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={true} />);
      expect(screen.getByTestId("now-playing-mini")).toHaveAttribute(
        "data-djs-count",
        "2"
      );
    });
  });

  describe("error states", () => {
    it("should handle latestEntryError gracefully", () => {
      mockUseGetNowPlayingQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      expect(() => render(<NowPlaying mini={false} />)).not.toThrow();
    });

    it("should handle djError gracefully", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      expect(() => render(<NowPlaying mini={false} />)).not.toThrow();
    });

    it("should handle both errors gracefully", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      mockUseGetNowPlayingQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      expect(() => render(<NowPlaying mini={false} />)).not.toThrow();
    });
  });

  describe("default props", () => {
    it("should default to mini=false", () => {
      // TypeScript requires mini prop, but test the behavior with false
      render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toBeInTheDocument();
    });
  });

  describe("combined states", () => {
    it("should render correctly with all data present", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      mockUseGetNowPlayingQuery.mockReturnValue({
        data: mockSongEntry,
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);

      const main = screen.getByTestId("now-playing-main");
      expect(main).toHaveAttribute("data-live", "true");
      expect(main).toHaveAttribute("data-on-air-dj", "DJ Cool");
      expect(main).toHaveAttribute("data-has-entry", "true");
      expect(main).toHaveAttribute("data-entry-id", "1");
      expect(main).toHaveAttribute("data-loading", "false");
    });

    it("should render correctly with loading states", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      mockUseGetNowPlayingQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      render(<NowPlaying mini={false} />);

      const main = screen.getByTestId("now-playing-main");
      expect(main).toHaveAttribute("data-live", "false");
      expect(main).toHaveAttribute("data-loading", "true");
    });
  });

  describe("mini vs main switching", () => {
    it("should pass different props to mini vs main", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: mockDJsOnAirData,
        isLoading: false,
        isError: false,
      });

      mockUseGetNowPlayingQuery.mockReturnValue({
        data: mockSongEntry,
        isLoading: false,
        isError: false,
      });

      // Test main gets onAirDJ (string)
      const { unmount } = render(<NowPlaying mini={false} />);
      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-on-air-dj",
        "DJ Cool"
      );
      unmount();

      // Test mini gets onAirDJs (array) - we check count
      render(<NowPlaying mini={true} />);
      expect(screen.getByTestId("now-playing-mini")).toHaveAttribute(
        "data-djs-count",
        "1"
      );
    });
  });
});
