import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import {
  MISSING_ARTIST_REJECTION_MESSAGE,
  VARIOUS_ARTISTS_REJECTION_MESSAGE,
} from "@/lib/features/flowsheet/various-artists-guard";
import { FlowsheetMoveContext } from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import MobileSongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/MobileSongEntry";
import { createTestFlowsheetEntry, renderWithProviders } from "@/tests/helpers";

const mockUseShowControl = vi.fn(() => ({
  live: true,
  currentShow: 100,
}));
const mockUpdateFlowsheet = vi.fn();
const mockDispatch = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useFlowsheetActions: () => ({ updateFlowsheet: mockUpdateFlowsheet }),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

vi.mock("@/src/components/experiences/modern/flowsheet/Entries/SongEntry/usePlayNow", () => ({
  usePlayNow: () => vi.fn(),
}));

// The tray's neighbors aren't under test — stub them down to markers.
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/SongEntry/FlowsheetEntryField", () => ({
  default: ({ name }: { name: string }) => <span data-testid={`field-${name}`} />,
}));
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntryControls", () => ({
  default: () => <span data-testid="song-entry-controls" />,
}));
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntryStatusChips", () => ({
  default: () => <span data-testid="status-chips" />,
}));
vi.mock("@/src/components/experiences/modern/flowsheet/Entries/Components/RemoveButton", () => ({
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

describe("MobileSongEntry discogsUnavailable artwork gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 100 });
  });

  it("renders the Not on Discogs badge instead of artwork_url when flagged", () => {
    const flaggedEntry = createTestFlowsheetEntry({
      track_title: "la paradoja",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      record_label: "Sonamos",
      artwork_url: "https://i.discogs.com/doga.jpg",
      discogsUnavailable: true,
    });

    renderWithProviders(
      <MobileSongEntry entry={flaggedEntry} playing={false} queue={false} />
    );

    expect(screen.getByLabelText("Not on Discogs")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the artwork <img> and no badge when unflagged", () => {
    const unflaggedEntry = createTestFlowsheetEntry({
      track_title: "la paradoja",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      record_label: "Sonamos",
      artwork_url: "https://i.discogs.com/doga.jpg",
      discogsUnavailable: undefined,
    });

    renderWithProviders(
      <MobileSongEntry entry={unflaggedEntry} playing={false} queue={false} />
    );

    expect(screen.queryByLabelText("Not on Discogs")).toBeNull();
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "https://i.discogs.com/doga.jpg");
  });

  it("surfaces discogsUnavailableNote via the badge tooltip", async () => {
    const flaggedEntry = createTestFlowsheetEntry({
      track_title: "la paradoja",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      record_label: "Sonamos",
      discogsUnavailable: true,
      discogsUnavailableNote: "embargoed until 2026-09-01",
    });

    const { user } = renderWithProviders(
      <MobileSongEntry entry={flaggedEntry} playing={false} queue={false} />
    );

    await user.hover(screen.getByLabelText("Not on Discogs"));

    expect(
      await screen.findByText("embargoed until 2026-09-01")
    ).toBeInTheDocument();
  });
});

// saveAll carries all four fields in one call, so a rejected artist has to
// block the whole write, not just the artist field. The escape hatch that
// lets a queue row's artist stay blank lives in the `queue` branch above
// this guard, so it must not be reachable through it.
describe("MobileSongEntry save-all artist guard", () => {
  const FIELD_ORDER = ["track_title", "artist_name", "album_title", "record_label"];

  const entry = (overrides: Partial<FlowsheetSongEntry> = {}) =>
    createTestFlowsheetEntry({
      id: 50,
      show_id: 100,
      track_title: "Metal Heart",
      artist_name: "Cat Power",
      album_title: "Moon Pix",
      record_label: "Matador",
      request_flag: false,
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({ live: true, currentShow: 100 });
  });

  function editArtistAndSave(props: Partial<Parameters<typeof MobileSongEntry>[0]>, artistValue: string) {
    renderWithProviders(
      <FlowsheetMoveContext.Provider value={{ moveEntry: mockMoveEntry }}>
        <MobileSongEntry entry={entry()} playing={false} queue={false} {...props} />
      </FlowsheetMoveContext.Provider>
    );
    fireEvent.click(screen.getByLabelText("Edit entry"));
    const artistInput = screen.getAllByRole("textbox")[FIELD_ORDER.indexOf("artist_name")];
    fireEvent.change(artistInput, { target: { value: artistValue } });
    fireEvent.click(screen.getByLabelText("Save entry"));
  }

  it.each(["Various Artists", "V/A", "VA"])(
    "refuses saving a posted entry's artist as %s",
    (artist) => {
      editArtistAndSave({ queue: false }, artist);

      expect(mockUpdateFlowsheet).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        VARIOUS_ARTISTS_REJECTION_MESSAGE
      );
      // Still in edit mode — the Save control, not the Edit control, is present.
      expect(screen.getByLabelText("Save entry")).toBeInTheDocument();
    }
  );

  it.each(["", "   "])(
    "refuses saving a posted entry with a blank artist (%j)",
    (artist) => {
      editArtistAndSave({ queue: false }, artist);

      expect(mockUpdateFlowsheet).not.toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(
        MISSING_ARTIST_REJECTION_MESSAGE
      );
      expect(screen.getByLabelText("Save entry")).toBeInTheDocument();
    }
  );

  it("saves normally when the posted entry's artist is a real performer", () => {
    editArtistAndSave({ queue: false }, "Jessica Pratt");

    expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
      entry_id: 50,
      data: expect.objectContaining({ artist_name: "Jessica Pratt" }),
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("still blanks a queue row's artist (the mail bin escape hatch)", async () => {
    const { flowsheetSlice } = await import("@/lib/features/flowsheet/frontend");

    editArtistAndSave({ queue: true }, "");

    expect(mockDispatch).toHaveBeenCalledWith(
      flowsheetSlice.actions.updateQueueEntry({
        entry_id: 50,
        field: "artist_name",
        value: "",
      })
    );
    expect(mockUpdateFlowsheet).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
