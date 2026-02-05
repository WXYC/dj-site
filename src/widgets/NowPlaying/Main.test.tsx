import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";
import React from "react";

// Track the ref's mock methods
const mockPlay = vi.fn();
const mockPause = vi.fn();
let mockIsPlayingState = false;

// Mock child components
vi.mock("./AlbumArtAndIcons", () => ({
  default: ({ entry }: any) => (
    <div data-testid="album-art-icons" data-has-entry={entry !== undefined} data-entry-id={entry?.id} />
  ),
}));

vi.mock("./EntryText", () => ({
  default: ({ entry }: any) => (
    <div data-testid="entry-text" data-has-entry={entry !== undefined} data-entry-id={entry?.id} />
  ),
}));

// Mock GradientAudioVisualizer with ref support using factory function
vi.mock("./GradientAudioVisualizer", () => ({
  GradientAudioVisualizer: React.forwardRef(({ src }: { src: string }, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      play: () => {
        mockPlay();
        mockIsPlayingState = true;
      },
      pause: () => {
        mockPause();
        mockIsPlayingState = false;
      },
      get isPlaying() {
        return mockIsPlayingState;
      },
    }));
    return <div data-testid="gradient-visualizer" data-src={src} />;
  }),
}));

// Mock MUI Joy components
vi.mock("@mui/joy", () => ({
  Box: ({ children, ...props }: any) => (
    <div data-testid="box" {...props}>
      {children}
    </div>
  ),
  CircularProgress: (props: any) => (
    <div data-testid="circular-progress" {...props} />
  ),
}));

vi.mock("@mui/joy/AspectRatio", () => ({
  default: ({ children, ratio, ...props }: any) => (
    <div data-testid="aspect-ratio" data-ratio={ratio} {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@mui/joy/Card", () => ({
  default: ({ children, sx, ...props }: any) => (
    <div
      data-testid="card"
      data-width={sx?.width}
      data-height={sx?.height}
      {...props}
    >
      {children}
    </div>
  ),
}));

vi.mock("@mui/joy/CardContent", () => ({
  default: ({ children, orientation, ...props }: any) => (
    <div data-testid="card-content" data-orientation={orientation} {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@mui/joy/CardOverflow", () => ({
  default: ({ children, variant, color, ...props }: any) => (
    <div
      data-testid="card-overflow"
      data-variant={variant}
      data-color={color}
      {...props}
    >
      {children}
    </div>
  ),
}));

vi.mock("@mui/joy/Divider", () => ({
  default: ({ orientation, ...props }: any) => (
    <hr data-testid="divider" data-orientation={orientation} {...props} />
  ),
}));

vi.mock("@mui/joy/IconButton", () => ({
  default: ({ children, onClick, "aria-label": ariaLabel, ...props }: any) => (
    <button
      data-testid="icon-button"
      onClick={onClick}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@mui/joy/Typography", () => ({
  default: ({ children, level, ...props }: any) => (
    <span data-testid="typography" data-level={level} {...props}>
      {children}
    </span>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Pause: () => <span data-testid="pause-icon" />,
  PlayArrow: () => <span data-testid="play-icon" />,
}));

// Import after mocks are set up
import NowPlayingMain from "./Main";

describe("NowPlayingMain", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPlayingState = false;
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() =>
        render(<NowPlayingMain live={false} />)
      ).not.toThrow();
    });

    it("should render Card component", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("should render GradientAudioVisualizer", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("gradient-visualizer")).toBeInTheDocument();
    });

    it("should render AlbumArtAndIcons component", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("album-art-icons")).toBeInTheDocument();
    });

    it("should render EntryText component", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("entry-text")).toBeInTheDocument();
    });

    it("should pass audio source to GradientAudioVisualizer", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("gradient-visualizer")).toHaveAttribute(
        "data-src",
        "https://audio-mp3.ibiblio.org/wxyc.mp3"
      );
    });
  });

  describe("dimensions", () => {
    it("should apply width prop to card", () => {
      render(<NowPlayingMain live={false} width={400} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-width", "400");
    });

    it("should apply height prop to card", () => {
      render(<NowPlayingMain live={false} height={300} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-height", "300");
    });

    it("should use 100% width when not specified", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-width", "100%");
    });

    it("should use 100% height when not specified", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-height", "100%");
    });
  });

  describe("play/pause toggle", () => {
    it("should show PlayArrow icon initially", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });

    it("should call play when clicking play button while paused", () => {
      render(<NowPlayingMain live={false} />);
      const button = screen.getByTestId("icon-button");
      fireEvent.click(button);
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it("should show Pause icon after clicking play", () => {
      render(<NowPlayingMain live={false} />);
      const button = screen.getByTestId("icon-button");
      fireEvent.click(button);
      expect(screen.getByTestId("pause-icon")).toBeInTheDocument();
    });

    it("should call pause when clicking button while playing", () => {
      render(<NowPlayingMain live={false} />);
      const button = screen.getByTestId("icon-button");
      // First click to play
      fireEvent.click(button);
      // Second click to pause
      fireEvent.click(button);
      expect(mockPause).toHaveBeenCalledTimes(1);
    });

    it("should show PlayArrow icon after pausing", () => {
      render(<NowPlayingMain live={false} />);
      const button = screen.getByTestId("icon-button");
      // First click to play
      fireEvent.click(button);
      // Second click to pause
      fireEvent.click(button);
      expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });
  });

  describe("live status", () => {
    it("should display 'LIVE' when live is true", () => {
      render(<NowPlayingMain live={true} />);
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });

    it("should display 'OFF AIR' when live is false", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByText("OFF AIR")).toBeInTheDocument();
    });

    it("should apply primary color to card overflow when live", () => {
      render(<NowPlayingMain live={true} />);
      const cardOverflows = screen.getAllByTestId("card-overflow");
      const liveOverflow = cardOverflows.find(
        (el) => el.getAttribute("data-color") === "primary"
      );
      expect(liveOverflow).toBeInTheDocument();
    });

    it("should apply neutral color to card overflow when not live", () => {
      render(<NowPlayingMain live={false} />);
      const cardOverflows = screen.getAllByTestId("card-overflow");
      const neutralOverflow = cardOverflows.find(
        (el) => el.getAttribute("data-color") === "neutral"
      );
      expect(neutralOverflow).toBeInTheDocument();
    });
  });

  describe("DJ name display", () => {
    it("should display DJ name when live and onAirDJ is provided", () => {
      render(<NowPlayingMain live={true} onAirDJ="DJ Cool" />);
      expect(screen.getByText("DJ Cool")).toBeInTheDocument();
    });

    it("should not display DJ name when not live", () => {
      render(<NowPlayingMain live={false} onAirDJ="DJ Cool" />);
      expect(screen.queryByText("DJ Cool")).not.toBeInTheDocument();
    });

    it("should display vertical divider when live", () => {
      render(<NowPlayingMain live={true} onAirDJ="DJ Cool" />);
      const dividers = screen.getAllByTestId("divider");
      const verticalDivider = dividers.find(
        (el) => el.getAttribute("data-orientation") === "vertical"
      );
      expect(verticalDivider).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("should show CircularProgress when loading is true and live", () => {
      render(<NowPlayingMain live={true} loading={true} />);
      expect(screen.getByTestId("circular-progress")).toBeInTheDocument();
    });

    it("should show CircularProgress when loading is true even if not live", () => {
      render(<NowPlayingMain live={false} loading={true} />);
      expect(screen.getByTestId("circular-progress")).toBeInTheDocument();
    });

    it("should not show DJ name when loading", () => {
      render(<NowPlayingMain live={true} loading={true} onAirDJ="DJ Cool" />);
      expect(screen.queryByText("DJ Cool")).not.toBeInTheDocument();
    });

    it("should not show CircularProgress when not loading and live", () => {
      render(<NowPlayingMain live={true} loading={false} onAirDJ="DJ Cool" />);
      expect(screen.queryByTestId("circular-progress")).not.toBeInTheDocument();
    });
  });

  describe("entry prop", () => {
    it("should pass song entry to AlbumArtAndIcons", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<NowPlayingMain live={false} entry={songEntry} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "true");
      expect(albumArt).toHaveAttribute("data-entry-id", "1");
    });

    it("should pass song entry to EntryText", () => {
      const songEntry: FlowsheetSongEntry = {
        ...baseEntry,
        track_title: "Test Track",
        artist_name: "Test Artist",
        album_title: "Test Album",
        record_label: "Test Label",
        request_flag: false,
      };

      render(<NowPlayingMain live={false} entry={songEntry} />);
      const entryText = screen.getByTestId("entry-text");
      expect(entryText).toHaveAttribute("data-has-entry", "true");
      expect(entryText).toHaveAttribute("data-entry-id", "1");
    });

    it("should pass breakpoint entry to child components", () => {
      const breakpointEntry: FlowsheetBreakpointEntry = {
        ...baseEntry,
        id: 2,
        message: "Breakpoint: Station ID",
        day: "Monday",
        time: "10:00",
      };

      render(<NowPlayingMain live={false} entry={breakpointEntry} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "true");
      expect(albumArt).toHaveAttribute("data-entry-id", "2");
    });

    it("should pass show block entry to child components", () => {
      const showBlockEntry: FlowsheetShowBlockEntry = {
        ...baseEntry,
        id: 3,
        dj_name: "DJ Cool",
        isStart: true,
        day: "Monday",
        time: "10:00",
      };

      render(<NowPlayingMain live={true} entry={showBlockEntry} />);
      const entryText = screen.getByTestId("entry-text");
      expect(entryText).toHaveAttribute("data-has-entry", "true");
      expect(entryText).toHaveAttribute("data-entry-id", "3");
    });

    it("should pass message entry to child components", () => {
      const messageEntry: FlowsheetMessageEntry = {
        ...baseEntry,
        id: 4,
        message: "PSA: Community announcement",
      };

      render(<NowPlayingMain live={false} entry={messageEntry} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "true");
      expect(albumArt).toHaveAttribute("data-entry-id", "4");
    });

    it("should handle undefined entry", () => {
      render(<NowPlayingMain live={false} entry={undefined} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "false");
    });
  });

  describe("aspect ratio", () => {
    it("should render AspectRatio component with ratio 2.5", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getByTestId("aspect-ratio")).toHaveAttribute(
        "data-ratio",
        "2.5"
      );
    });
  });

  describe("card content structure", () => {
    it("should render CardContent component", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getAllByTestId("card-content").length).toBeGreaterThan(0);
    });

    it("should render CardOverflow components", () => {
      render(<NowPlayingMain live={false} />);
      expect(screen.getAllByTestId("card-overflow").length).toBe(2);
    });

    it("should render horizontal CardContent for live status", () => {
      render(<NowPlayingMain live={true} onAirDJ="DJ Cool" />);
      const cardContents = screen.getAllByTestId("card-content");
      const horizontalContent = cardContents.find(
        (el) => el.getAttribute("data-orientation") === "horizontal"
      );
      expect(horizontalContent).toBeInTheDocument();
    });
  });
});
