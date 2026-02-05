import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GoLive from "./GoLive";

// Mock flowsheet hooks
const mockGoLive = vi.fn();
const mockLeave = vi.fn();
const mockSetAutoPlay = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
    autoplay: false,
    setAutoPlay: mockSetAutoPlay,
    loading: false,
    goLive: mockGoLive,
    leave: mockLeave,
  })),
}));

describe("GoLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render when not live", () => {
    render(<GoLive />);
    expect(screen.getByText(/You Are Off Air/)).toBeInTheDocument();
  });

  it("should show 'You Are On Air' when live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    expect(screen.getByText(/You Are On Air/)).toBeInTheDocument();
  });

  it("should call goLive when clicking go live button while not live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    // The WiFi icon button (index 1)
    const goLiveButton = buttons[1];
    fireEvent.click(goLiveButton);

    expect(mockGoLive).toHaveBeenCalled();
  });

  it("should call leave when clicking leave button while live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const leaveButton = buttons[1];
    fireEvent.click(leaveButton);

    expect(mockLeave).toHaveBeenCalled();
  });

  it("should toggle autoplay when clicking autoplay button", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: 1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const autoplayButton = buttons[0];
    fireEvent.click(autoplayButton);

    expect(mockSetAutoPlay).toHaveBeenCalledWith(true);
  });

  it("should disable autoplay button when not live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: false,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    const autoplayButton = buttons[0];
    expect(autoplayButton).toBeDisabled();
  });

  it("should show loading state", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
      autoplay: false,
      setAutoPlay: mockSetAutoPlay,
      loading: true,
      goLive: mockGoLive,
      leave: mockLeave,
      currentShow: -1,
    });

    render(<GoLive />);
    const buttons = screen.getAllByRole("button");
    // Go live button should be disabled when loading
    expect(buttons[1]).toBeDisabled();
  });
});
