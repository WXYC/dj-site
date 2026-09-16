import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import type {
  FlowsheetSongEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
  FlowsheetMessageEntry,
  OnAirDJResponse,
} from "@/lib/features/flowsheet/types";
import type { MutableRefObject, RefObject } from "react";

// Mock child components
vi.mock("@/src/widgets/NowPlaying/AlbumArtAndIcons", () => ({
  default: ({ entry }: any) => (
    <div data-testid="album-art-icons" data-has-entry={entry !== undefined} data-entry-id={entry?.id} />
  ),
}));

vi.mock("@/src/widgets/NowPlaying/EntryText", () => ({
  default: ({ entry }: any) => (
    <div data-testid="entry-text" data-has-entry={entry !== undefined} data-entry-id={entry?.id} />
  ),
}));

// Mock GradientAudioVisualizer -- now takes props instead of ref
vi.mock("@/src/widgets/NowPlaying/GradientAudioVisualizer", () => ({
  GradientAudioVisualizer: ({ isPlaying, overlayColor }: any) => (
    <div
      data-testid="gradient-visualizer"
      data-is-playing={isPlaying}
      data-overlay-color={overlayColor}
    />
  ),
}));

// Mock useColorScheme hook
const mockMode = vi.fn(() => "light" as string | undefined);
vi.mock("@mui/joy/styles", () => ({
  useColorScheme: () => ({ mode: mockMode() }),
  // `renderWithProviders` wraps every render in this; the rest of the file
  // mocks Joy away, so it has to resolve to something renderable.
  CssVarsProvider: ({ children }: any) => <>{children}</>,
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
import NowPlayingMini from "@/src/widgets/NowPlaying/Mini";

function createDefaultProps(overrides: Record<string, any> = {}) {
  return {
    live: false as boolean,
    audioRef: { current: null } as RefObject<HTMLAudioElement | null>,
    isPlaying: false,
    onTogglePlay: vi.fn(),
    audioContext: null as AudioContext | null,
    analyserNode: null as AnalyserNode | null,
    animationFrameRef: { current: null } as MutableRefObject<number | null>,
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

  describe("overlay color", () => {
    it("masks the visualizer with the themed surface in every mode", () => {
      for (const mode of ["light", "dark", undefined] as const) {
        mockMode.mockReturnValue(mode);
        const { unmount } = render(<NowPlayingMini {...createDefaultProps()} />);
        expect(screen.getByTestId("gradient-visualizer")).toHaveAttribute(
          "data-overlay-color",
          "background.surface"
        );
        unmount();
      }
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
        { id: "1", dj_name: "Turncoat" },
        { id: "2", dj_name: "desire path" },
      ];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getByText("Turncoat")).toBeInTheDocument();
      expect(screen.getByText("desire path")).toBeInTheDocument();
    });

    it("should render Chip component for each DJ", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "Turncoat" },
        { id: "2", dj_name: "desire path" },
      ];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getAllByTestId("chip").length).toBe(2);
    });

    it("should render Headset icon in each DJ chip", () => {
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name: "Turncoat" }];
      render(<NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />);
      expect(screen.getByTestId("headset-icon")).toBeInTheDocument();
    });

    it("should render multiple Headset icons for multiple DJs", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "Turncoat" },
        { id: "2", dj_name: "desire path" },
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

  // An anonymous DJ reaches this widget with no name: the backend resolves a
  // blank or "Anonymous" on-air handle to null. A chip with nothing in it
  // reads as a rendering fault, so such a DJ gets no chip — liveness is the
  // LIVE badge's job, and it counts the roster rather than the chips.
  describe("DJs with no on-air handle", () => {
    it.each([
      ["a null name", null],
      ["an empty name", ""],
      ["a whitespace-only name", "   "],
    ])("renders no chip for %s", (_label, dj_name) => {
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name }];
      render(
        <NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />
      );
      expect(screen.queryByTestId("chip")).not.toBeInTheDocument();
    });

    it("keeps the named DJ and drops the nameless one from a mixed roster", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "Turncoat" },
        { id: "2", dj_name: null },
      ];
      render(
        <NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />
      );
      expect(screen.getAllByTestId("chip")).toHaveLength(1);
      expect(screen.getByText("Turncoat")).toBeInTheDocument();
    });

    it("still reads LIVE when every DJ on air is nameless", () => {
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name: null }];
      render(
        <NowPlayingMini {...createDefaultProps({ live: true, onAirDJs: djs })} />
      );
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });
  });

  // Handles are not unique and `id` is null for a DJ with no account, so a
  // roster can hold two entries that are indistinguishable by either field
  // alone. The reconciler needs them told apart regardless.
  describe("DJ chip keys", () => {
    function keyWarningsDuring(djs: OnAirDJResponse[]): unknown[][] {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      try {
        render(
          <NowPlayingMini
            {...createDefaultProps({ live: true, onAirDJs: djs })}
          />
        );
        return consoleError.mock.calls.filter((args) =>
          args.some((arg) => typeof arg === "string" && arg.includes("key"))
        );
      } finally {
        consoleError.mockRestore();
      }
    }

    it("distinguishes two DJs sharing a handle", () => {
      const djs: OnAirDJResponse[] = [
        { id: "1", dj_name: "Turncoat" },
        { id: "2", dj_name: "Turncoat" },
      ];
      expect(keyWarningsDuring(djs)).toEqual([]);
      expect(screen.getAllByTestId("chip")).toHaveLength(2);
    });

    it("distinguishes two account-less DJs sharing a handle", () => {
      const djs: OnAirDJResponse[] = [
        { id: null, dj_name: "Turncoat" },
        { id: null, dj_name: "Turncoat" },
      ];
      expect(keyWarningsDuring(djs)).toEqual([]);
      expect(screen.getAllByTestId("chip")).toHaveLength(2);
    });

    it("warns about nothing when two anonymous DJs are on air together", () => {
      const djs: OnAirDJResponse[] = [
        { id: null, dj_name: null },
        { id: null, dj_name: null },
      ];
      expect(keyWarningsDuring(djs)).toEqual([]);
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
        segue: false,
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
        segue: false,
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
      const djs: OnAirDJResponse[] = [{ id: "1", dj_name: "Turncoat" }];
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
