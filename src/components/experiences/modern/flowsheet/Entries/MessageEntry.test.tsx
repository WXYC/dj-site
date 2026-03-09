import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageEntry from "./MessageEntry";
import {
  FlowsheetMessageEntry,
  FlowsheetShowBlockEntry,
} from "@/lib/features/flowsheet/types";

// Mock hooks
const mockUseShowControl = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
}));

// Mock motion/react
vi.mock("motion/react", () => ({
  useDragControls: () => ({
    start: vi.fn(),
  }),
}));

// Mock child components
vi.mock("./Components/DragButton", () => ({
  default: ({ controls }: any) => (
    <button data-testid="drag-button">Drag</button>
  ),
}));

vi.mock("./Components/RemoveButton", () => ({
  default: ({ queue, entry }: any) => (
    <button data-testid="remove-button" data-queue={queue}>
      Remove {entry.id}
    </button>
  ),
}));

vi.mock("./DraggableEntryWrapper", () => ({
  default: ({ children, variant, color, style }: any) => (
    <tr
      data-testid="draggable-wrapper"
      data-variant={variant}
      data-color={color}
      style={style}
    >
      {children}
    </tr>
  ),
}));

describe("MessageEntry", () => {
  const mockMessageEntry: FlowsheetMessageEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    message: "Test message",
  };

  const mockStartShowEntry: FlowsheetShowBlockEntry = {
    id: 2,
    play_order: 0,
    show_id: 100,
    dj_name: "DJ Test",
    day: "Monday",
    time: "10:00 PM",
    isStart: true,
  };

  const mockEndShowEntry: FlowsheetShowBlockEntry = {
    id: 3,
    play_order: 10,
    show_id: 100,
    dj_name: "DJ Test",
    day: "Monday",
    time: "12:00 AM",
    isStart: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({
      live: true,
      currentShow: 100,
    });
  });

  describe("Basic rendering", () => {
    it("should render children content", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          <span>Test Child Content</span>
        </MessageEntry>
      );

      expect(screen.getByText("Test Child Content")).toBeInTheDocument();
    });

    it("should render start decorator when provided", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
          startDecorator={<span data-testid="start-icon">Icon</span>}
        >
          Content
        </MessageEntry>
      );

      expect(screen.getByTestId("start-icon")).toBeInTheDocument();
    });

    it("should render end decorator when provided", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
          endDecorator={<span data-testid="end-decorator">End</span>}
        >
          Content
        </MessageEntry>
      );

      expect(screen.getByTestId("end-decorator")).toBeInTheDocument();
    });

    it("should pass color to DraggableEntryWrapper", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="primary"
          variant="soft"
        >
          Content
        </MessageEntry>
      );

      expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
        "data-color",
        "primary"
      );
    });

    it("should pass variant to DraggableEntryWrapper", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="solid"
        >
          Content
        </MessageEntry>
      );

      expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
        "data-variant",
        "solid"
      );
    });
  });

  describe("Editable state", () => {
    describe("when live and entry belongs to current show", () => {
      beforeEach(() => {
        mockUseShowControl.mockReturnValue({
          live: true,
          currentShow: 100,
        });
      });

      it("should show DragButton when editable", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.getByTestId("drag-button")).toBeInTheDocument();
      });

      it("should show RemoveButton for non-show block entries", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.getByTestId("remove-button")).toBeInTheDocument();
      });

      it("should NOT show RemoveButton for start show entries", () => {
        render(
          <MessageEntry
            entryRef={mockStartShowEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
      });

      it("should NOT show RemoveButton for end show entries", () => {
        render(
          <MessageEntry
            entryRef={mockEndShowEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
      });
    });

    describe("when disableEditing is true", () => {
      it("should NOT show DragButton when disableEditing is true", () => {
        mockUseShowControl.mockReturnValue({
          live: true,
          currentShow: 100,
        });

        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
            disableEditing={true}
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("drag-button")).not.toBeInTheDocument();
      });

      it("should NOT show RemoveButton when disableEditing is true", () => {
        mockUseShowControl.mockReturnValue({
          live: true,
          currentShow: 100,
        });

        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
            disableEditing={true}
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
      });
    });

    describe("when not live", () => {
      beforeEach(() => {
        mockUseShowControl.mockReturnValue({
          live: false,
          currentShow: 100,
        });
      });

      it("should NOT show DragButton when not live", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("drag-button")).not.toBeInTheDocument();
      });

      it("should NOT show RemoveButton when not live", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
      });
    });

    describe("when entry belongs to different show", () => {
      beforeEach(() => {
        mockUseShowControl.mockReturnValue({
          live: true,
          currentShow: 999, // Different show
        });
      });

      it("should NOT show DragButton when entry is from different show", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("drag-button")).not.toBeInTheDocument();
      });

      it("should NOT show RemoveButton when entry is from different show", () => {
        render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
      });
    });
  });

  describe("Remove button queue prop", () => {
    it("should pass queue=false to RemoveButton", () => {
      mockUseShowControl.mockReturnValue({
        live: true,
        currentShow: 100,
      });

      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          Content
        </MessageEntry>
      );

      expect(screen.getByTestId("remove-button")).toHaveAttribute(
        "data-queue",
        "false"
      );
    });
  });

  describe("Styling", () => {
    it("should set height style to 40px", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          Content
        </MessageEntry>
      );

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveStyle({ height: "40px" });
    });
  });

  describe("Edge cases", () => {
    it("should handle entry with no decorators", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          Minimal content
        </MessageEntry>
      );

      expect(screen.getByText("Minimal content")).toBeInTheDocument();
    });

    it("should handle complex children", () => {
      render(
        <MessageEntry
          entryRef={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          <div>
            <span>Line 1</span>
            <span>Line 2</span>
          </div>
        </MessageEntry>
      );

      expect(screen.getByText("Line 1")).toBeInTheDocument();
      expect(screen.getByText("Line 2")).toBeInTheDocument();
    });

    it("should handle multiple color variants", () => {
      const colors = ["neutral", "primary", "success", "warning", "danger"];

      colors.forEach((color) => {
        const { unmount } = render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color={color as any}
            variant="soft"
          >
            Content
          </MessageEntry>
        );

        expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
          "data-color",
          color
        );
        unmount();
      });
    });

    it("should handle multiple variant types", () => {
      const variants = ["soft", "solid", "plain", "outlined"];

      variants.forEach((variant) => {
        const { unmount } = render(
          <MessageEntry
            entryRef={mockMessageEntry}
            color="neutral"
            variant={variant as any}
          >
            Content
          </MessageEntry>
        );

        expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
          "data-variant",
          variant
        );
        unmount();
      });
    });
  });
});
