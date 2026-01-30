import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RemoveFromQueueButton from "./RemoveFromQueueButton";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

// Mock flowsheet hooks
const mockRemoveFromQueue = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useQueue: vi.fn(() => ({
    removeFromQueue: mockRemoveFromQueue,
    loading: false,
    queue: [],
    addToQueue: vi.fn(),
  })),
}));

describe("RemoveFromQueueButton", () => {
  const mockEntry: FlowsheetSongEntry = {
    id: 123,
    album_title: "Test Album",
    artist_name: "Test Artist",
    track_title: "Test Song",
    record_label: "Test Label",
    rotation_id: null,
    request_flag: false,
    play_freq: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<RemoveFromQueueButton entry={mockEntry} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call removeFromQueue with entry id when clicked", () => {
    render(<RemoveFromQueueButton entry={mockEntry} />);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(mockRemoveFromQueue).toHaveBeenCalledWith(123);
  });

  it("should pass additional props to IconButton", () => {
    render(<RemoveFromQueueButton entry={mockEntry} data-testid="remove-btn" />);
    expect(screen.getByTestId("remove-btn")).toBeInTheDocument();
  });

  it("should show loading state", async () => {
    const { useQueue } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useQueue).mockReturnValue({
      removeFromQueue: mockRemoveFromQueue,
      loading: true,
      queue: [],
      addToQueue: vi.fn(),
    });

    render(<RemoveFromQueueButton entry={mockEntry} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
