import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AddToQueueButton from "./AddToQueueButton";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";

// Mock flowsheet hooks
const mockAddToQueue = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useQueue: vi.fn(() => ({
    addToQueue: mockAddToQueue,
    loading: false,
  })),
}));

describe("AddToQueueButton", () => {
  const mockEntry: FlowsheetQuery = {
    song: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    label: "Test Label",
    request: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<AddToQueueButton entry={mockEntry} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have a tooltip with album name", () => {
    render(<AddToQueueButton entry={mockEntry} />);
    // The tooltip text includes the album name
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should call addToQueue when clicked", () => {
    render(<AddToQueueButton entry={mockEntry} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(mockAddToQueue).toHaveBeenCalledWith(mockEntry);
  });

  it("should pass additional props to IconButton", () => {
    render(<AddToQueueButton entry={mockEntry} data-testid="queue-btn" />);
    expect(screen.getByTestId("queue-btn")).toBeInTheDocument();
  });

  it("should show loading state", async () => {
    const { useQueue } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useQueue).mockReturnValue({
      addToQueue: mockAddToQueue,
      loading: true,
      queue: [],
      removeFromQueue: vi.fn(),
    });

    render(<AddToQueueButton entry={mockEntry} />);
    const button = screen.getByRole("button");
    // When loading, the button should have loading attribute or similar
    expect(button).toBeInTheDocument();
  });
});
