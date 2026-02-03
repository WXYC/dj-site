import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NowPlaying from "./index";

// Mock RTK Query hooks
const mockUseGetNowPlayingQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  isError: false,
}));

const mockUseWhoIsLiveQuery = vi.fn(() => ({
  data: undefined,
  isLoading: false,
  isError: false,
}));

vi.mock("@/lib/features/flowsheet/api", () => ({
  useGetNowPlayingQuery: () => mockUseGetNowPlayingQuery(),
  useWhoIsLiveQuery: () => mockUseWhoIsLiveQuery(),
}));

// Mock useAlbumImages hook
vi.mock("@/src/hooks/applicationHooks", () => ({
  useAlbumImages: vi.fn(() => ({
    setAlbum: vi.fn(),
    setArtist: vi.fn(),
    loading: false,
    url: "/img/cassette.png",
  })),
}));

// Mock child components
vi.mock("./Main", () => ({
  default: ({ entry, live, onAirDJ, loading }: any) => (
    <div data-testid="now-playing-main" data-live={live} data-loading={loading}>
      {onAirDJ && <span data-testid="on-air-dj">{onAirDJ}</span>}
    </div>
  ),
}));

vi.mock("./Mini", () => ({
  default: ({ entry, live, onAirDJs }: any) => (
    <div data-testid="now-playing-mini" data-live={live}>
      {onAirDJs && <span data-testid="on-air-djs">{onAirDJs.length}</span>}
    </div>
  ),
}));

describe("NowPlaying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when mini is false (default)", () => {
    it("should render NowPlayingMain component", () => {
      render(<NowPlaying mini={false} />);

      expect(screen.getByTestId("now-playing-main")).toBeInTheDocument();
      expect(screen.queryByTestId("now-playing-mini")).not.toBeInTheDocument();
    });

    it("should render audio element", () => {
      render(<NowPlaying mini={false} />);

      const audio = document.getElementById("now-playing-music");
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute("crossOrigin", "anonymous");
    });
  });

  describe("when mini is true", () => {
    it("should render NowPlayingMini component", () => {
      render(<NowPlaying mini={true} />);

      expect(screen.getByTestId("now-playing-mini")).toBeInTheDocument();
      expect(screen.queryByTestId("now-playing-main")).not.toBeInTheDocument();
    });
  });

  describe("live status", () => {
    it("should show live=false when no DJ data", () => {
      render(<NowPlaying mini={false} />);

      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });

    it("should show live=false when DJ is Off Air", () => {
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

    it("should show live=true when DJ is on air", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { onAir: "DJ Cool", djs: [{ id: "1", dj_name: "DJ Cool" }] },
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);

      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "true"
      );
    });

    it("should show live=false when DJ query has error", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { onAir: "DJ Cool", djs: [{ id: "1", dj_name: "DJ Cool" }] },
        isLoading: false,
        isError: true,
      });

      render(<NowPlaying mini={false} />);

      expect(screen.getByTestId("now-playing-main")).toHaveAttribute(
        "data-live",
        "false"
      );
    });
  });

  describe("loading state", () => {
    it("should pass loading state to NowPlayingMain", () => {
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
  });

  describe("on air DJ", () => {
    it("should pass onAirDJ to NowPlayingMain", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: { onAir: "DJ Cool", djs: [{ id: "1", dj_name: "DJ Cool" }] },
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={false} />);

      expect(screen.getByTestId("on-air-dj")).toHaveTextContent("DJ Cool");
    });

    it("should pass onAirDJs to NowPlayingMini", () => {
      mockUseWhoIsLiveQuery.mockReturnValue({
        data: {
          onAir: "DJ Cool & DJ Rad",
          djs: [
            { id: "1", dj_name: "DJ Cool" },
            { id: "2", dj_name: "DJ Rad" },
          ],
        },
        isLoading: false,
        isError: false,
      });

      render(<NowPlaying mini={true} />);

      expect(screen.getByTestId("on-air-djs")).toHaveTextContent("2");
    });
  });
});
