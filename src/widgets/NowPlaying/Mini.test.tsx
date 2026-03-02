import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
  OnAirDJResponse,
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

// Mock useColorScheme hook
const mockMode = vi.fn((): string | undefined => "light");
vi.mock("@mui/joy/styles", () => ({
  useColorScheme: () => ({ mode: mockMode() }),
}));

// Mock MUI Joy components
vi.mock("@mui/joy", () => ({
  Card: ({ children, orientation, ...props }: any) => (
    <div
      data-testid="card"
      data-orientation={orientation}
      {...props}
    >
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardOverflow: ({ children, variant, color, ...props }: any) => (
    <div
      data-testid="card-overflow"
      data-variant={variant}
      data-color={color}
      {...props}
    >
      {children}
    </div>
  ),
  Chip: ({ children, startDecorator, ...props }: any) => (
    <div data-testid="chip" {...props}>
      {startDecorator}
      {children}
    </div>
  ),
  IconButton: ({ children, onClick, "aria-label": ariaLabel, ...props }: any) => (
    <button
      data-testid="icon-button"
      onClick={onClick}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
  Stack: ({ children, direction, ...props }: any) => (
    <div data-testid="stack" data-direction={direction} {...props}>
      {children}
    </div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Headset: () => <span data-testid="headset-icon" />,
  Pause: () => <span data-testid="pause-icon" />,
  PlayArrow: () => <span data-testid="play-icon" />,
}));

// Import after mocks are set up
import NowPlayingMini from "./Mini";

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

describe("NowPlayingMini", () => {
  const baseEntry = {
    id: 1,
    play_order: 1,
    show_id: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMode.mockReturnValue("light");
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<NowPlayingMini {...createDefaultProps()} />)).not.toThrow();
    });

    it("should render Card component with horizontal orientation", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("card")).toHaveAttribute(
        "data-orientation",
        "horizontal"
      );
    });

    it("should render GradientAudioVisualizer", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("gradient-visualizer")).toBeInTheDocument();
    });

    it("should render AlbumArtAndIcons component", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("album-art-icons")).toBeInTheDocument();
    });

    it("should render EntryText component", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("entry-text")).toBeInTheDocument();
    });
  });

  describe("color scheme", () => {
    it("should pass white overlay color in light mode", () => {
      mockMode.mockReturnValue("light");
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("gradient-visualizer")).toHaveAttribute(
        "data-overlay-color",
        "white"
      );
    });

    it("should pass neutral.800 overlay color in dark mode", () => {
      mockMode.mockReturnValue("dark");
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("gradient-visualizer")).toHaveAttribute(
        "data-overlay-color",
        "neutral.800"
      );
    });

    it("should pass neutral.800 overlay color when mode is undefined", () => {
      mockMode.mockReturnValue(undefined);
      render(<NowPlayingMini {...createDefaultProps()} />);
      // When mode is undefined, it's not "light", so it goes to else branch
      expect(screen.getByTestId("gradient-visualizer")).toHaveAttribute(
        "data-overlay-color",
        "neutral.800"
      );
    });
  });

  describe("play/pause toggle", () => {
    it("should show PlayArrow icon when not playing", () => {
      render(<NowPlayingMini {...createDefaultProps({ isPlaying: false })} />);
      expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    });

    it("should show Pause icon when playing", () => {
      render(<NowPlayingMini {...createDefaultProps({ isPlaying: true })} />);
      expect(screen.getByTestId("pause-icon")).toBeInTheDocument();
    });

    it("should call onTogglePlay when clicking the button", () => {
      const onTogglePlay = vi.fn();
      render(<NowPlayingMini {...createDefaultProps({ onTogglePlay })} />);
      const button = screen.getByTestId("icon-button");
      fireEvent.click(button);
      expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it("should call onTogglePlay on second click too", () => {
      const onTogglePlay = vi.fn();
      render(<NowPlayingMini {...createDefaultProps({ onTogglePlay })} />);
      const button = screen.getByTestId("icon-button");
      fireEvent.click(button);
      fireEvent.click(button);
      expect(onTogglePlay).toHaveBeenCalledTimes(2);
    });

    it("should have correct aria-label when not playing", () => {
      render(<NowPlayingMini {...createDefaultProps({ isPlaying: false })} />);
      const button = screen.getByTestId("icon-button");
      expect(button).toHaveAttribute("aria-label", "Play audio");
    });

    it("should have correct aria-label when playing", () => {
      render(<NowPlayingMini {...createDefaultProps({ isPlaying: true })} />);
      const button = screen.getByTestId("icon-button");
      expect(button).toHaveAttribute("aria-label", "Pause audio");
    });
  });

  describe("live status", () => {
    it("should display 'LIVE' when live is true", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: true })} />);
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });

    it("should display 'OFF AIR' when live is false", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: false })} />);
      expect(screen.getByText("OFF AIR")).toBeInTheDocument();
    });

    it("should apply primary color to card overflow when live", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: true })} />);
      expect(screen.getByTestId("card-overflow")).toHaveAttribute(
        "data-color",
        "primary"
      );
    });

    it("should apply neutral color to card overflow when not live", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: false })} />);
      expect(screen.getByTestId("card-overflow")).toHaveAttribute(
        "data-color",
        "neutral"
      );
    });
  });

  describe("DJs display", () => {
    it("should display DJ chips when onAirDJs is provided", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "DJ Cool" },
        { id: "2", dj_name: "DJ Hot" },
      ];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getByText("DJ DJ Cool")).toBeInTheDocument();
      expect(screen.getByText("DJ DJ Hot")).toBeInTheDocument();
    });

    it("should render Chip component for each DJ", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "DJ Cool" },
        { id: "2", dj_name: "DJ Hot" },
      ];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getAllByTestId("chip").length).toBe(2);
    });

    it("should render Headset icon in each DJ chip", () => {
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name: "DJ Cool" }];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getByTestId("headset-icon")).toBeInTheDocument();
    });

    it("should render multiple Headset icons for multiple DJs", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "DJ Cool" },
        { id: "2", dj_name: "DJ Hot" },
      ];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getAllByTestId("headset-icon").length).toBe(2);
    });

    it("should not render chips when onAirDJs is undefined", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: true })} />);
      expect(screen.queryByTestId("chip")).not.toBeInTheDocument();
    });

    it("should not render chips when onAirDJs is empty", () => {
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: [] })} />);
      expect(screen.queryByTestId("chip")).not.toBeInTheDocument();
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

      render(<NowPlayingMini {...createDefaultProps({ entry: songEntry })} />);
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

      render(<NowPlayingMini {...createDefaultProps({ entry: songEntry })} />);
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

      render(<NowPlayingMini {...createDefaultProps({ entry: breakpointEntry })} />);
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

      render(<NowPlayingMini {...createDefaultProps({ live: true, entry: showBlockEntry })} />);
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

      render(<NowPlayingMini {...createDefaultProps({ entry: messageEntry })} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "true");
      expect(albumArt).toHaveAttribute("data-entry-id", "4");
    });

    it("should handle undefined entry", () => {
      render(<NowPlayingMini {...createDefaultProps({ entry: undefined })} />);
      const albumArt = screen.getByTestId("album-art-icons");
      expect(albumArt).toHaveAttribute("data-has-entry", "false");
    });
  });

  describe("card structure", () => {
    it("should render CardContent components", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getAllByTestId("card-content").length).toBe(2);
    });

    it("should render CardOverflow component", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("card-overflow")).toBeInTheDocument();
    });

    it("should render Stack for DJ chips with row direction", () => {
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name: "DJ Cool" }];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      const stacks = screen.getAllByTestId("stack");
      const rowStack = stacks.find(
        (el) => el.getAttribute("data-direction") === "row"
      );
      expect(rowStack).toBeInTheDocument();
    });
  });

  describe("variant styling", () => {
    it("should render CardOverflow with soft variant", () => {
      render(<NowPlayingMini {...createDefaultProps()} />);
      expect(screen.getByTestId("card-overflow")).toHaveAttribute(
        "data-variant",
        "soft"
      );
    });
  });
});
