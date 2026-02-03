import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MessageEntry from "./MessageEntry";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
    currentShow: 1,
  })),
}));

// Mock framer-motion
vi.mock("motion/react", () => ({
  useDragControls: vi.fn(() => ({})),
}));

// Mock child components
vi.mock("./Components/DragButton", () => ({
  default: () => <button data-testid="drag-button">Drag</button>,
}));

vi.mock("./Components/RemoveButton", () => ({
  default: ({ entry }: any) => (
    <button data-testid="remove-button">Remove</button>
  ),
}));

vi.mock("./DraggableEntryWrapper", () => ({
  default: ({ children, color, variant }: any) => (
    <tr data-testid="draggable-wrapper" data-color={color} data-variant={variant}>
      {children}
    </tr>
  ),
}));

describe("MessageEntry", () => {
  const mockEntry: FlowsheetEntry = {
    id: 1,
    show_id: 1,
    entry_type: "message",
    message: "Test message",
  } as FlowsheetEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children content", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
          >
            <span>Test Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("should render start decorator", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
            startDecorator={<span data-testid="start-decorator">Start</span>}
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("start-decorator")).toBeInTheDocument();
  });

  it("should render end decorator", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
            endDecorator={<span data-testid="end-decorator">End</span>}
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("end-decorator")).toBeInTheDocument();
  });

  it("should pass color to wrapper", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="danger"
            variant="soft"
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
      "data-color",
      "danger"
    );
  });

  it("should pass variant to wrapper", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="outlined"
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("draggable-wrapper")).toHaveAttribute(
      "data-variant",
      "outlined"
    );
  });

  it("should not show drag button when not live", () => {
    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.queryByTestId("drag-button")).not.toBeInTheDocument();
  });

  it("should show drag button when live and editable", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      currentShow: 1,
    } as any);

    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("drag-button")).toBeInTheDocument();
  });

  it("should not show controls when disableEditing is true", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
      currentShow: 1,
    } as any);

    render(
      <table>
        <tbody>
          <MessageEntry
            entryRef={mockEntry}
            color="primary"
            variant="soft"
            disableEditing={true}
          >
            <span>Content</span>
          </MessageEntry>
        </tbody>
      </table>
    );

    expect(screen.queryByTestId("drag-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-button")).not.toBeInTheDocument();
  });
});
