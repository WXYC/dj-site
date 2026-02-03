import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NowPlayingMini from "./Mini";
import type { FlowsheetEntry, OnAirDJResponse } from "@/lib/features/flowsheet/types";

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

// Mock MUI styles
vi.mock("@mui/joy/styles", () => ({
  useColorScheme: vi.fn(() => ({
    mode: "light",
  })),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Headset: () => <span data-testid="headset-icon" />,
  Pause: () => <span data-testid="pause-icon">Pause</span>,
  PlayArrow: () => <span data-testid="play-icon">Play</span>,
}));

describe("NowPlayingMini", () => {
  const mockEntry: FlowsheetEntry = {
    id: 1,
    song: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    label: "Test Label",
  } as FlowsheetEntry;

  const mockDJs: OnAirDJResponse[] = [
    { id: 1, dj_name: "DJ Cool" },
    { id: 2, dj_name: "DJ Rad" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render card with visualizer", () => {
    render(<NowPlayingMini live={false} />);

    expect(screen.getByTestId("audio-visualizer")).toBeInTheDocument();
  });

  it("should render album art component", () => {
    render(<NowPlayingMini entry={mockEntry} live={false} />);

    expect(screen.getByTestId("album-art")).toBeInTheDocument();
    expect(screen.getByText("Test Album")).toBeInTheDocument();
  });

  it("should render entry text component", () => {
    render(<NowPlayingMini entry={mockEntry} live={false} />);

    expect(screen.getByTestId("entry-text")).toBeInTheDocument();
    expect(screen.getByText("Test Song")).toBeInTheDocument();
  });

  it("should show LIVE text when live is true", () => {
    render(<NowPlayingMini live={true} />);

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("should show OFF AIR text when live is false", () => {
    render(<NowPlayingMini live={false} />);

    expect(screen.getByText("OFF AIR")).toBeInTheDocument();
  });

  it("should render DJ chips when onAirDJs is provided", () => {
    render(<NowPlayingMini live={true} onAirDJs={mockDJs} />);

    expect(screen.getByText("DJ DJ Cool")).toBeInTheDocument();
    expect(screen.getByText("DJ DJ Rad")).toBeInTheDocument();
    expect(screen.getAllByTestId("headset-icon")).toHaveLength(2);
  });

  it("should show play icon by default", () => {
    render(<NowPlayingMini live={false} />);

    expect(screen.getByTestId("play-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("pause-icon")).not.toBeInTheDocument();
  });

  it("should have a play button that can be clicked", () => {
    render(<NowPlayingMini live={false} />);

    const playButton = screen.getByRole("button");
    expect(playButton).toBeInTheDocument();
    fireEvent.click(playButton); // Should not throw
  });

  it("should have accessible button labels", () => {
    render(<NowPlayingMini live={false} />);

    expect(screen.getByRole("button", { name: /play audio/i })).toBeInTheDocument();
  });
});
