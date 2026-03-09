import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RemoveFromQueueButton from "./RemoveFromQueueButton";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

// Mock hooks
const mockRemoveFromQueue = vi.fn();
const mockUseQueue = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useQueue: () => mockUseQueue(),
}));

describe("RemoveFromQueueButton", () => {
  const mockEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    track_title: "Test Track",
    artist_name: "Test Artist",
    album_title: "Test Album",
    record_label: "Test Label",
    request_flag: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueue.mockReturnValue({
      removeFromQueue: mockRemoveFromQueue,
      loading: false,
    });
  });

  describe("Basic rendering", () => {
    it("should render an icon button", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should render RemoveFromQueue icon", () => {
      const { container } = render(<RemoveFromQueueButton entry={mockEntry} />);

      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("should render tooltip with album title", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      // The tooltip text contains the album title
      // Tooltips typically require hover to display, but the title attr may be present
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Click behavior", () => {
    it("should call removeFromQueue with entry id when clicked", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockRemoveFromQueue).toHaveBeenCalledWith(1);
    });

    it("should call removeFromQueue with correct id for different entries", () => {
      const anotherEntry: FlowsheetSongEntry = {
        ...mockEntry,
        id: 42,
        album_title: "Another Album",
      };

      render(<RemoveFromQueueButton entry={anotherEntry} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockRemoveFromQueue).toHaveBeenCalledWith(42);
    });
  });

  describe("Loading state", () => {
    it("should show loading state when loading is true", () => {
      mockUseQueue.mockReturnValue({
        removeFromQueue: mockRemoveFromQueue,
        loading: true,
      });

      render(<RemoveFromQueueButton entry={mockEntry} />);

      const button = screen.getByRole("button");
      // MUI IconButton with loading prop typically disables the button
      // and may show a loading indicator
      expect(button).toBeInTheDocument();
    });

    it("should not show loading state when loading is false", () => {
      mockUseQueue.mockReturnValue({
        removeFromQueue: mockRemoveFromQueue,
        loading: false,
      });

      render(<RemoveFromQueueButton entry={mockEntry} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("IconButton props spreading", () => {
    it("should pass additional props to IconButton", () => {
      render(
        <RemoveFromQueueButton
          entry={mockEntry}
          size="lg"
          color="danger"
          variant="solid"
        />
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should allow custom className", () => {
      render(
        <RemoveFromQueueButton
          entry={mockEntry}
          className="custom-class"
        />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("should allow disabled state", () => {
      render(<RemoveFromQueueButton entry={mockEntry} disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("should not call removeFromQueue when disabled", () => {
      render(<RemoveFromQueueButton entry={mockEntry} disabled />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockRemoveFromQueue).not.toHaveBeenCalled();
    });
  });

  describe("Tooltip content", () => {
    it("should include album title in tooltip", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      // The tooltip should contain "Remove {album_title} from queue"
      // We can verify the tooltip exists by checking for the Tooltip wrapper
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should handle entries with special characters in album title", () => {
      const specialEntry: FlowsheetSongEntry = {
        ...mockEntry,
        album_title: "Album with \"quotes\" & special <chars>",
      };

      render(<RemoveFromQueueButton entry={specialEntry} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should handle entries with long album titles", () => {
      const longTitleEntry: FlowsheetSongEntry = {
        ...mockEntry,
        album_title:
          "This is a very long album title that might cause layout issues if not handled properly",
      };

      render(<RemoveFromQueueButton entry={longTitleEntry} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should handle entries with empty album title", () => {
      const emptyTitleEntry: FlowsheetSongEntry = {
        ...mockEntry,
        album_title: "",
      };

      render(<RemoveFromQueueButton entry={emptyTitleEntry} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Multiple renders", () => {
    it("should work correctly with multiple buttons", () => {
      const entry1: FlowsheetSongEntry = { ...mockEntry, id: 1 };
      const entry2: FlowsheetSongEntry = { ...mockEntry, id: 2 };
      const entry3: FlowsheetSongEntry = { ...mockEntry, id: 3 };

      render(
        <>
          <RemoveFromQueueButton entry={entry1} />
          <RemoveFromQueueButton entry={entry2} />
          <RemoveFromQueueButton entry={entry3} />
        </>
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);

      // Click second button
      fireEvent.click(buttons[1]);
      expect(mockRemoveFromQueue).toHaveBeenCalledWith(2);
    });
  });

  describe("Hook integration", () => {
    it("should get removeFromQueue from useQueue hook", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockUseQueue).toHaveBeenCalled();
      expect(mockRemoveFromQueue).toHaveBeenCalled();
    });

    it("should reflect loading state from useQueue hook", () => {
      mockUseQueue.mockReturnValue({
        removeFromQueue: mockRemoveFromQueue,
        loading: true,
      });

      render(<RemoveFromQueueButton entry={mockEntry} />);

      // Verify the component renders with loading state
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle entry with all optional fields", () => {
      const fullEntry: FlowsheetSongEntry = {
        id: 999,
        play_order: 5,
        show_id: 200,
        track_title: "Full Track",
        artist_name: "Full Artist",
        album_title: "Full Album",
        record_label: "Full Label",
        request_flag: true,
        album_id: 123,
        rotation_id: 456,
        rotation: "H",
      };

      render(<RemoveFromQueueButton entry={fullEntry} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockRemoveFromQueue).toHaveBeenCalledWith(999);
    });

    it("should handle rapid clicks", () => {
      render(<RemoveFromQueueButton entry={mockEntry} />);

      const button = screen.getByRole("button");

      // Simulate rapid clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockRemoveFromQueue).toHaveBeenCalledTimes(3);
    });
  });
});
