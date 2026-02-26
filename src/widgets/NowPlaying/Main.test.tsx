import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
} from "@/lib/features/flowsheet/types";
import React from "react";

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

// Mock GradientAudioVisualizer -- now takes props instead of ref
vi.mock("./GradientAudioVisualizer", () => ({
  GradientAudioVisualizer: ({ isPlaying, overlayColor }: any) => (
    <div
      data-testid="gradient-visualizer"
      data-is-playing={isPlaying}
      data-overlay-color={overlayColor}
    />
  ),
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

function createDefaultProps(overrides: Record<string, any> = {}) {
  return {
    live: false as boolean,
    audioRef: { current: null } as React.RefObject<HTMLAudioElement>,
    isPlaying: false,
    onTogglePlay: vi.fn(),
    audioContext: null as AudioContext | null,
    analyserNode: null as AnalyserNode | null,
    animationFrameRef: { current: null } as React.MutableRefObject<number | null>,
    ...overrides,
  };
}

describe("NowPlayingMain", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() =>
        render(<NowPlayingMain {...createDefaultProps()} />)
      ).not.toThrow();
    });

    it("should render Card component", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("card")).toBeInTheDocument();
    });

    it("should render GradientAudioVisualizer", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("gradient-visualizer")).toBeInTheDocument();
    });

    it("should render AlbumArtAndIcons component", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("album-art-icons")).toBeInTheDocument();
    });

    it("should render EntryText component", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("entry-text")).toBeInTheDocument();
    });
  });

  describe("dimensions", () => {
    it("should apply width prop to card", () => {
      render(<NowPlayingMain {...createDefaultProps({ width: 400 })} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-width", "400");
    });

    it("should apply height prop to card", () => {
      render(<NowPlayingMain {...createDefaultProps({ height: 300 })} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-height", "300");
    });

    it("should use 100% width when not specified", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-width", "100%");
    });

    it("should use 100% height when not specified", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("card")).toHaveAttribute("data-height", "100%");
    });
  });

  describe("play/pause toggle", () => {
    it("should show PlayArrow icon when not playing", () => {
      render(<NowPlayingMain {...createDefaultProps({ isPlaying: false })} />);
      expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });

    it("should show Pause icon when playing", () => {
      render(<NowPlayingMain {...createDefaultProps({ isPlaying: true })} />);
      expect(screen.getByTestId("pause-icon")).toBeInTheDocument();
    });

    it("should call onTogglePlay when clicking the button", () => {
      const onTogglePlay = vi.fn();
      render(<NowPlayingMain {...createDefaultProps({ onTogglePlay })} />);
      const button = screen.getByTestId("icon-button");
      fireEvent.click(button);
      expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it("should have correct aria-label when not playing", () => {
      render(<NowPlayingMain {...createDefaultProps({ isPlaying: false })} />);
      const button = screen.getByTestId("icon-button");
      expect(button).toHaveAttribute("aria-label", "Play audio");
    });

    it("should have correct aria-label when playing", () => {
      render(<NowPlayingMain {...createDefaultProps({ isPlaying: true })} />);
      const button = screen.getByTestId("icon-button");
      expect(button).toHaveAttribute("aria-label", "Pause audio");
    });
  });

  describe("live status", () => {
    it("should display 'LIVE' when live is true", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true })} />);
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });

    it("should display 'OFF AIR' when live is false", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: false })} />);
      expect(screen.getByText("OFF AIR")).toBeInTheDocument();
    });

    it("should apply primary color to card overflow when live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true })} />);
      const cardOverflows = screen.getAllByTestId("card-overflow");
      const liveOverflow = cardOverflows.find(
        (el) => el.getAttribute("data-color") === "primary"
      );
      expect(liveOverflow).toBeInTheDocument();
    });

    it("should apply neutral color to card overflow when not live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: false })} />);
      const cardOverflows = screen.getAllByTestId("card-overflow");
      const neutralOverflow = cardOverflows.find(
        (el) => el.getAttribute("data-color") === "neutral"
      );
      expect(neutralOverflow).toBeInTheDocument();
    });
  });

  describe("DJ name display", () => {
    it("should display DJ name when live and onAirDJ is provided", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, onAirDJ: "DJ Cool" })} />);
      expect(screen.getByText("DJ Cool")).toBeInTheDocument();
    });

    it("should not display DJ name when not live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: false, onAirDJ: "DJ Cool" })} />);
      expect(screen.queryByText("DJ Cool")).not.toBeInTheDocument();
    });

    it("should display vertical divider when live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, onAirDJ: "DJ Cool" })} />);
      const dividers = screen.getAllByTestId("divider");
      const verticalDivider = dividers.find(
        (el) => el.getAttribute("data-orientation") === "vertical"
      );
      expect(verticalDivider).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("should show CircularProgress when loading is true and live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, loading: true })} />);
      expect(screen.getByTestId("circular-progress")).toBeInTheDocument();
    });

    it("should show CircularProgress when loading is true even if not live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: false, loading: true })} />);
      expect(screen.getByTestId("circular-progress")).toBeInTheDocument();
    });

    it("should not show DJ name when loading", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, loading: true, onAirDJ: "DJ Cool" })} />);
      expect(screen.queryByText("DJ Cool")).not.toBeInTheDocument();
    });

    it("should not show CircularProgress when not loading and live", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, loading: false, onAirDJ: "DJ Cool" })} />);
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

      render(<NowPlayingMain {...createDefaultProps({ entry: songEntry })} />);
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

      render(<NowPlayingMain {...createDefaultProps({ entry: songEntry })} />);
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

      render(<NowPlayingMain {...createDefaultProps({ entry: breakpointEntry })} />);
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

      render(<NowPlayingMain {...createDefaultProps({ live: true, entry: showBlockEntry })} />);
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

      render(<NowPlayingMain {...createDefaultProps({ entry: messageEntry })} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "true");
      expect(albumArt).toHaveAttribute("data-entry-id", "4");
    });

    it("should handle undefined entry", () => {
      render(<NowPlayingMain {...createDefaultProps({ entry: undefined })} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "false");
    });
  });

  describe("aspect ratio", () => {
    it("should render AspectRatio component with ratio 2.5", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getByTestId("aspect-ratio")).toHaveAttribute(
        "data-ratio",
        "2.5"
      );
    });
  });

  describe("card content structure", () => {
    it("should render CardContent component", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getAllByTestId("card-content").length).toBeGreaterThan(0);
    });

    it("should render CardOverflow components", () => {
      render(<NowPlayingMain {...createDefaultProps()} />);
      expect(screen.getAllByTestId("card-overflow").length).toBe(2);
    });

    it("should render horizontal CardContent for live status", () => {
      render(<NowPlayingMain {...createDefaultProps({ live: true, onAirDJ: "DJ Cool" })} />);
      const cardContents = screen.getAllByTestId("card-content");
      const horizontalContent = cardContents.find(
        (el) => el.getAttribute("data-orientation") === "horizontal"
      );
      expect(horizontalContent).toBeInTheDocument();
    });
  });
});
