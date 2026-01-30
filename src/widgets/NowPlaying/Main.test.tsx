import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NowPlayingMain from "./Main";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

// Mock GradientAudioVisualizer
vi.mock("./GradientAudioVisualizer", () => ({
  GradientAudioVisualizer: vi.fn().mockImplementation(({ ref }) => {
    if (ref) {
      ref.current = {
        play: vi.fn(),
        pause: vi.fn(),
        isPlaying: false,
      };
    }
    return <div data-testid="audio-visualizer" />;
  }),
}));

// Mock child components
vi.mock("./AlbumArtAndIcons", () => ({
  default: ({ entry }: any) => (
    <div data-testid="album-art">{entry?.album || "No album"}</div>
  ),
}));

vi.mock("./EntryText", () => ({
  default: ({ entry }: any) => (
    <div data-testid="entry-text">{entry?.song || "No song"}</div>
  ),
}));

// Mock MUI components
vi.mock("@mui/icons-material", () => ({
  Pause: () => <span data-testid="pause-icon">Pause</span>,
  PlayArrow: () => <span data-testid="play-icon">Play</span>,
}));

describe("NowPlayingMain", () => {
  const mockEntry: FlowsheetEntry = {
    id: 1,
    song: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    label: "Test Label",
  } as FlowsheetEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render card with visualizer", () => {
    render(<NowPlayingMain live={false} />);

    expect(screen.getByTestId("audio-visualizer")).toBeInTheDocument();
  });

  it("should render album art component", () => {
    render(<NowPlayingMain entry={mockEntry} live={false} />);

    expect(screen.getByTestId("album-art")).toBeInTheDocument();
    expect(screen.getByText("Test Album")).toBeInTheDocument();
  });

  it("should render entry text component", () => {
    render(<NowPlayingMain entry={mockEntry} live={false} />);

    expect(screen.getByTestId("entry-text")).toBeInTheDocument();
    expect(screen.getByText("Test Song")).toBeInTheDocument();
  });

  it("should show LIVE text when live is true", () => {
    render(<NowPlayingMain live={true} />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("should show OFF AIR text when live is false", () => {
    render(<NowPlayingMain live={false} />);

    expect(screen.getByText("OFF AIR")).toBeInTheDocument();
  });

  it("should show DJ name when live and onAirDJ is provided", () => {
    render(<NowPlayingMain live={true} onAirDJ="DJ Cool" />);

    expect(screen.getByText("DJ Cool")).toBeInTheDocument();
  });

  it("should show play icon by default", () => {
    render(<NowPlayingMain live={false} />);

    expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("pause-icon")).not.toBeInTheDocument();
  });

  it("should have a play button that can be clicked", () => {
    render(<NowPlayingMain live={false} />);

    const playButton = screen.getByRole("button");
    expect(playButton).toBeInTheDocument();
    fireEvent.click(playButton); // Should not throw
  });

  it("should render with custom width and height", () => {
    render(<NowPlayingMain live={false} width={400} height={300} />);

    expect(screen.getByTestId("audio-visualizer")).toBeInTheDocument();
  });
});
