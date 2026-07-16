import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageEntry from "@/src/components/experiences/modern/flowsheet/Entries/MessageEntry";
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
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/Components/DragButton", () => ({
  default: ({ controls }: any) => (
    <button data-testid="drag-button">Drag</button>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/Components/RemoveButton", () => ({
  default: ({ queue, entry }: any) => (
    <button data-testid="remove-button" data-queue={queue}>
      Remove {entry.id}
    </button>
  ),
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/DraggableEntryWrapper", () => ({
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
          entry={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          <span>Test Child Content</span>
        </MessageEntry>
      );

      // The message renders exactly once; its span cell's colSpan tracks the
      // breakpoint via useMediaQuery (4 at xl, 2 below — jsdom matches false,
      // so tests see the sub-xl span).
      expect(screen.getAllByText("Test Child Content")).toHaveLength(1);
      expect(
        screen.getByText("Test Child Content").closest("td")
      ).toHaveAttribute("colspan", "2");
    });

    it("should render start decorator when provided", () => {
      render(
        <MessageEntry
          entry={mockMessageEntry}
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
          entry={mockMessageEntry}
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
          entry={mockMessageEntry}
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
          entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockStartShowEntry}
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
            entry={mockEndShowEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
          entry={mockMessageEntry}
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
          entry={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          Content
        </MessageEntry>
      );

      const wrapper = screen.getByTestId("draggable-wrapper");
      expect(wrapper).toHaveStyle({ height: "40px" });
    });

    it("should span the data columns so message rows match song rows", () => {
      render(
        <MessageEntry entry={mockMessageEntry} color="neutral" variant="soft">
          Content
        </MessageEntry>
      );

      // Song rows are art + 2 stacked data cells + actions below xl (jsdom
      // matches false), so the whole marker row must also total 4 column
      // units. At xl both grow in lock-step to 6 (see the colSpan comment in
      // MessageEntry.tsx).
      const cells = Array.from(
        screen.getByTestId("draggable-wrapper").querySelectorAll("td")
      );
      const totalColumns = cells.reduce((sum, td) => sum + td.colSpan, 0);
      expect(totalColumns).toBe(4);
    });
  });

  describe("Edge cases", () => {
    it("should handle entry with no decorators", () => {
      render(
        <MessageEntry
          entry={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          Minimal content
        </MessageEntry>
      );

      expect(screen.getAllByText("Minimal content")).toHaveLength(1);
    });

    it("should handle complex children", () => {
      render(
        <MessageEntry
          entry={mockMessageEntry}
          color="neutral"
          variant="soft"
        >
          <div>
            <span>Line 1</span>
            <span>Line 2</span>
          </div>
        </MessageEntry>
      );

      expect(screen.getAllByText("Line 1")).toHaveLength(1);
      expect(screen.getAllByText("Line 2")).toHaveLength(1);
    });

    it("should handle multiple color variants", () => {
      const colors = ["neutral", "primary", "success", "warning", "danger"];

      colors.forEach((color) => {
        const { unmount } = render(
          <MessageEntry
            entry={mockMessageEntry}
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
            entry={mockMessageEntry}
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
