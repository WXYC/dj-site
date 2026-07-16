import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DraggableEntryWrapper from "@/src/components/experiences/modern/flowsheet/Entries/DraggableEntryWrapper";
import { FlowsheetDragContext } from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import { FlowsheetSongEntry, FlowsheetMessageEntry } from "@/lib/features/flowsheet/types";
import { DragControls } from "motion/react";

// Mock MUI Joy theme
vi.mock("@mui/joy/styles", () => ({
  useTheme: () => ({
    palette: {
      primary: {
        plainBg: "#e3f2fd",
        softBg: "#bbdefb",
        solidBg: "#1976d2",
      },
      success: {
        plainBg: "#e8f5e9",
        softBg: "#c8e6c9",
        solidBg: "#4caf50",
      },
      neutral: {
        plainBg: "#fafafa",
        softBg: "#f5f5f5",
        solidBg: "#9e9e9e",
      },
      warning: {
        plainBg: "#fff3e0",
        softBg: "#ffe0b2",
        solidBg: "#ff9800",
      },
      danger: {
        plainBg: "#ffebee",
        softBg: "#ffcdd2",
        solidBg: "#f44336",
      },
      background: {
        backdrop: "rgba(0, 0, 0, 0.5)",
      },
    },
  }),
}));

// Mock motion/react Reorder, capturing the props each Reorder.Item received
// so tests can invoke the drag lifecycle callbacks directly.
const reorderItemProps: any[] = [];
vi.mock("motion/react", () => ({
  Reorder: {
    Item: ({ children, value, as, onDragStart, onDragEnd, style, dragListener, dragControls, ...props }: any) => {
      reorderItemProps.push({ value, onDragStart, onDragEnd, dragListener });
      const Component = as || "div";
      // Filter out any non-DOM props to avoid React warnings
      const domProps = Object.keys(props).reduce((acc: any, key) => {
        // Only keep valid DOM attributes
        if (!key.startsWith("drag")) {
          acc[key] = props[key];
        }
        return acc;
      }, {});
      return (
        <Component
          data-testid="reorder-item"
          data-value={JSON.stringify(value)}
          style={style}
          {...domProps}
        >
          {children}
        </Component>
      );
    },
  },
}));

describe("DraggableEntryWrapper", () => {
  const mockSongEntry: FlowsheetSongEntry = {
    id: 1,
    play_order: 0,
    show_id: 100,
    track_title: "la paradoja",
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    request_flag: false,
    segue: false,
  };

  const mockMessageEntry: FlowsheetMessageEntry = {
    id: 2,
    play_order: 1,
    show_id: 100,
    message: "Talkset",
  };

  const mockDragControls: DragControls = {
    start: vi.fn(),
  } as unknown as DragControls;

  const mockOnEntryDragStart = vi.fn();
  const mockOnEntryDragEnd = vi.fn();

  function renderWithDragContext(ui: React.ReactElement) {
    return render(
      <FlowsheetDragContext.Provider
        value={{
          onEntryDragStart: mockOnEntryDragStart,
          onEntryDragEnd: mockOnEntryDragEnd,
        }}
      >
        {ui}
      </FlowsheetDragContext.Provider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    reorderItemProps.length = 0;
  });

  describe("Basic rendering", () => {
    it("should render children content", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Test Child Content</td>
        </DraggableEntryWrapper>
      );

      expect(screen.getByText("Test Child Content")).toBeInTheDocument();
    });

    it("should render as a tr element", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      expect(item.tagName.toLowerCase()).toBe("tr");
    });

    it("should pass entry reference as value to Reorder.Item", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      const value = JSON.parse(item.getAttribute("data-value") || "{}");
      expect(value.id).toBe(mockSongEntry.id);
    });

    it("should render with message entry", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockMessageEntry}
          controls={mockDragControls}
        >
          <td>{mockMessageEntry.message}</td>
        </DraggableEntryWrapper>
      );

      expect(screen.getByText("Talkset")).toBeInTheDocument();
    });

    it("should gate dragging behind the handle (dragListener false)", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      expect(reorderItemProps).toHaveLength(1);
      expect(reorderItemProps[0].dragListener).toBe(false);
    });
  });

  describe("Drag lifecycle context wiring", () => {
    it("should call onEntryDragStart from context when drag starts", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      reorderItemProps[0].onDragStart();
      expect(mockOnEntryDragStart).toHaveBeenCalledTimes(1);
      expect(mockOnEntryDragEnd).not.toHaveBeenCalled();
    });

    it("should call onEntryDragEnd with the entry when drag ends", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      reorderItemProps[0].onDragEnd();
      expect(mockOnEntryDragEnd).toHaveBeenCalledTimes(1);
      expect(mockOnEntryDragEnd).toHaveBeenCalledWith(mockSongEntry);
    });

    it("should not call drag callbacks on render", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      expect(mockOnEntryDragStart).not.toHaveBeenCalled();
      expect(mockOnEntryDragEnd).not.toHaveBeenCalled();
    });

    it("should render without a provider via the no-op default context", () => {
      render(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      expect(() => reorderItemProps[0].onDragStart()).not.toThrow();
      expect(() => reorderItemProps[0].onDragEnd()).not.toThrow();
    });
  });

  describe("Non-draggable render path", () => {
    it("should render a plain tr (no Reorder.Item) when draggable is false", () => {
      renderWithDragContext(
        <table>
          <tbody>
            <DraggableEntryWrapper
              entry={mockSongEntry}
              controls={mockDragControls}
              draggable={false}
            >
              <td>Content</td>
            </DraggableEntryWrapper>
          </tbody>
        </table>
      );

      expect(reorderItemProps).toHaveLength(0);
      expect(screen.queryByTestId("reorder-item")).not.toBeInTheDocument();
      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      expect(item.tagName.toLowerCase()).toBe("tr");
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("should keep the same testid and custom style on the plain tr path", () => {
      renderWithDragContext(
        <table>
          <tbody>
            <DraggableEntryWrapper
              entry={mockSongEntry}
              controls={mockDragControls}
              draggable={false}
              style={{ opacity: 0.5, height: "60px" }}
            >
              <td>Content</td>
            </DraggableEntryWrapper>
          </tbody>
        </table>
      );

      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      expect(item.style.opacity).toBe("0.5");
      expect(item.style.height).toBe("60px");
    });

    it("should apply the variant row class on both render paths", () => {
      renderWithDragContext(
        <>
          <DraggableEntryWrapper
            entry={mockSongEntry}
            controls={mockDragControls}
            variant="solid"
          >
            <td>Draggable</td>
          </DraggableEntryWrapper>
          <table>
            <tbody>
              <DraggableEntryWrapper
                entry={mockMessageEntry}
                controls={mockDragControls}
                variant="solid"
                draggable={false}
              >
                <td>Static</td>
              </DraggableEntryWrapper>
            </tbody>
          </table>
        </>
      );

      expect(
        screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`).className
      ).toContain("row-playing");
      expect(
        screen.getByTestId(`flowsheet-entry-${mockMessageEntry.id}`).className
      ).toContain("row-playing");
    });
  });

  describe("Variant and color styling", () => {
    it("should apply plain variant styling by default", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      expect(item.className).toContain("row-plain");
    });

    it("should merge custom style with the computed row style", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
          style={{ marginBottom: "10px" }}
        >
          <td>Content</td>
        </DraggableEntryWrapper>
      );

      const item = screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`);
      expect(item.style.marginBottom).toBe("10px");
    });

    it("should handle solid, soft, and outlined variants", () => {
      for (const variant of ["solid", "soft", "outlined"] as const) {
        const { unmount } = renderWithDragContext(
          <DraggableEntryWrapper
            entry={mockSongEntry}
            controls={mockDragControls}
            variant={variant}
          >
            <td>Content</td>
          </DraggableEntryWrapper>
        );
        expect(
          screen.getByTestId(`flowsheet-entry-${mockSongEntry.id}`)
        ).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe("Multiple children", () => {
    it("should render multiple td children", () => {
      renderWithDragContext(
        <DraggableEntryWrapper
          entry={mockSongEntry}
          controls={mockDragControls}
        >
          <td>Cell 1</td>
          <td>Cell 2</td>
          <td>Cell 3</td>
        </DraggableEntryWrapper>
      );

      expect(screen.getByText("Cell 1")).toBeInTheDocument();
      expect(screen.getByText("Cell 2")).toBeInTheDocument();
      expect(screen.getByText("Cell 3")).toBeInTheDocument();
    });
  });
});
