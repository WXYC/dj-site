import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RemoveButton from "./RemoveButton";

const mockRemoveFromQueue = vi.fn();
const mockRemoveFromFlowsheet = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheet: () => ({
    removeFromQueue: mockRemoveFromQueue,
    removeFromFlowsheet: mockRemoveFromFlowsheet,
  }),
}));

const mockSongEntry = {
  id: 1,
  play_order: 0,
  show_id: 1,
  track_title: "Test Song",
  artist_name: "Test Artist",
  album_title: "Test Album",
  record_label: "Test Label",
  request_flag: false,
};

const mockBreakpointEntry = {
  id: 2,
  play_order: 1,
  show_id: 1,
  message: "Station ID",
};

describe("RemoveButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<RemoveButton queue={false} entry={mockSongEntry} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call removeFromQueue when queue is true", () => {
    render(<RemoveButton queue={true} entry={mockSongEntry} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockRemoveFromQueue).toHaveBeenCalledWith(1);
  });

  it("should call removeFromFlowsheet when queue is false", () => {
    render(<RemoveButton queue={false} entry={mockSongEntry} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockRemoveFromFlowsheet).toHaveBeenCalledWith(1);
  });

  it("should render Clear icon", () => {
    const { container } = render(<RemoveButton queue={false} entry={mockSongEntry} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("should work with non-song entries", () => {
    render(<RemoveButton queue={false} entry={mockBreakpointEntry} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockRemoveFromFlowsheet).toHaveBeenCalledWith(2);
  });
});
