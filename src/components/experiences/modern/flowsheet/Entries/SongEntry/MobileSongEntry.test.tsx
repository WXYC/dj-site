import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { FlowsheetMoveContext } from "../dragContext";
import MobileSongEntry from "./MobileSongEntry";

const mockUseShowControl = vi.fn(() => ({
  live: true,
  currentShow: 100,
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useFlowsheetActions: () => ({ updateFlowsheet: vi.fn() }),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => vi.fn(),
}));

vi.mock("./usePlayNow", () => ({
  usePlayNow: () => vi.fn(),
}));

// The tray's neighbors aren't under test — stub them down to markers.
vi.mock("./FlowsheetEntryField", () => ({
  default: ({ name }: { name: string }) => <span data-testid={`field-${name}`} />,
}));
vi.mock("./SongEntryControls", () => ({
  default: () => <span data-testid="song-entry-controls" />,
}));
vi.mock("./SongEntryStatusChips", () => ({
  default: () => <span data-testid="status-chips" />,
}));
vi.mock("../Components/RemoveButton", () => ({
  default: () => <span data-testid="remove-button" />,
}));

const entry: FlowsheetSongEntry = {
  id: 7,
  play_order: 4,
  show_id: 100,
  track_title: "la paradoja",
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  request_flag: false,
};

const mockMoveEntry = vi.fn();

function renderCard(props: Partial<Parameters<typeof MobileSongEntry>[0]> = {}) {
  return render(
    <FlowsheetMoveContext.Provider value={{ moveEntry: mockMoveEntry }}>
      <MobileSongEntry entry={entry} playing={false} queue={false} {...props} />
    </FlowsheetMoveContext.Provider>
  );
}

describe("MobileSongEntry move buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 100 });
  });

  it("renders both arrows when the entry can move", () => {
    renderCard({ canMoveUp: true, canMoveDown: true });

    expect(screen.getByLabelText("Move up")).toBeInTheDocument();
    expect(screen.getByLabelText("Move down")).toBeInTheDocument();
  });

  it("calls moveEntry with the entry and direction", () => {
    renderCard({ canMoveUp: true, canMoveDown: true });

    fireEvent.click(screen.getByLabelText("Move up"));
    expect(mockMoveEntry).toHaveBeenCalledWith(entry, "up");

    fireEvent.click(screen.getByLabelText("Move down"));
    expect(mockMoveEntry).toHaveBeenCalledWith(entry, "down");
  });

  it("disables the edge direction (top entry can only move down)", () => {
    renderCard({ canMoveUp: false, canMoveDown: true });

    expect(screen.getByLabelText("Move up")).toBeDisabled();
    expect(screen.getByLabelText("Move down")).toBeEnabled();
  });

  it("renders no arrows when the entry cannot move at all", () => {
    renderCard();

    expect(screen.queryByLabelText("Move up")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move down")).not.toBeInTheDocument();
  });

  it("renders no arrows when not editable (previous-show entry)", () => {
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 999 });
    renderCard({ canMoveUp: true, canMoveDown: true });

    expect(screen.queryByLabelText("Move up")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move down")).not.toBeInTheDocument();
  });
});
