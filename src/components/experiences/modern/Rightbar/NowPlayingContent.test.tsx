import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NowPlayingContent from "./NowPlayingContent";

// Mock API hooks
const mockUseGetRightbarQuery = vi.fn((): { data: boolean | undefined } => ({
  data: false,
}));

vi.mock("@/lib/features/application/api", () => ({
  useGetRightbarQuery: () => mockUseGetRightbarQuery(),
}));

// Mock child components
vi.mock("@/src/widgets/NowPlaying", () => ({
  default: ({ mini }: { mini: boolean }) => (
    <div data-testid="now-playing" data-mini={mini ? "true" : "false"}>
      NowPlaying Widget
    </div>
  ),
}));

vi.mock("./RightBarContentContainer", () => ({
  default: ({ children, label, startDecorator, endDecorator }: any) => (
    <div data-testid="content-container" data-label={label}>
      <div data-testid="start-decorator">{startDecorator}</div>
      <div data-testid="end-decorator">{endDecorator}</div>
      {children}
    </div>
  ),
}));

vi.mock("./RightbarMiniSwitcher", () => ({
  default: () => <div data-testid="mini-switcher">MiniSwitcher</div>,
}));

vi.mock("@mui/icons-material", () => ({
  PlayArrowOutlined: () => <span data-testid="play-icon">PlayIcon</span>,
}));

describe("NowPlayingContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
    });
  });

  it("should render content container with correct label", () => {
    render(<NowPlayingContent />);

    const container = screen.getByTestId("content-container");
    expect(container).toHaveAttribute("data-label", "Now Playing");
  });

  it("should render play icon in start decorator", () => {
    render(<NowPlayingContent />);

    expect(screen.getByTestId("play-icon")).toBeInTheDocument();
  });

  it("should render mini switcher in end decorator", () => {
    render(<NowPlayingContent />);

    expect(screen.getByTestId("mini-switcher")).toBeInTheDocument();
  });

  it("should render NowPlaying widget", () => {
    render(<NowPlayingContent />);

    expect(screen.getByTestId("now-playing")).toBeInTheDocument();
  });

  it("should pass mini=false to NowPlaying when data is false", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
    });

    render(<NowPlayingContent />);

    const nowPlaying = screen.getByTestId("now-playing");
    expect(nowPlaying).toHaveAttribute("data-mini", "false");
  });

  it("should pass mini=true to NowPlaying when data is true", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: true,
    });

    render(<NowPlayingContent />);

    const nowPlaying = screen.getByTestId("now-playing");
    expect(nowPlaying).toHaveAttribute("data-mini", "true");
  });

  it("should default to mini=false when data is undefined", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: undefined,
    });

    render(<NowPlayingContent />);

    const nowPlaying = screen.getByTestId("now-playing");
    expect(nowPlaying).toHaveAttribute("data-mini", "false");
  });
});
