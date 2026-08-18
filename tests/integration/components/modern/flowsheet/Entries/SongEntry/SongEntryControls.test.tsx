import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, createTestFlowsheetEntry } from "@/tests/helpers";
import SongEntryControls from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntryControls";

const mockUpdateFlowsheet = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockRemoveFromFlowsheet = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetActions: () => ({
    updateFlowsheet: mockUpdateFlowsheet,
    removeFromQueue: mockRemoveFromQueue,
    removeFromFlowsheet: mockRemoveFromFlowsheet,
  }),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

// SongEntryControls' commit() only ever carries "segue" or "request_flag" —
// its own type signature makes an artist_name payload unreachable, so the
// artist guard added to the other flowsheet-write call sites has nothing to
// check here. These tests pin that: the checkbox commits keep working
// unmodified, and never trip the guard's toast.
describe("SongEntryControls segue/request commits (unaffected by the artist guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const entry = () =>
    createTestFlowsheetEntry({
      id: 60,
      artist_name: "Stereolab",
      track_title: "Miss Modular",
      album_title: "Dots and Loops",
      record_label: "Duophonic",
      segue: false,
      request_flag: false,
    });

  it("commits a segue toggle straight through updateFlowsheet on a posted entry", () => {
    renderWithProviders(
      <SongEntryControls entry={entry()} queue={false} editable={true} />
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Segue from previous track" })
    );

    expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
      entry_id: 60,
      data: { segue: true },
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("commits a request toggle straight through updateFlowsheet on a posted entry", () => {
    renderWithProviders(
      <SongEntryControls entry={entry()} queue={false} editable={true} />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Requested track" }));

    expect(mockUpdateFlowsheet).toHaveBeenCalledWith({
      entry_id: 60,
      data: { request_flag: true },
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("routes a segue toggle to the queue reducer instead of updateFlowsheet when queued", () => {
    renderWithProviders(
      <SongEntryControls entry={entry()} queue={true} editable={true} />
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Segue from previous track" })
    );

    expect(mockUpdateFlowsheet).not.toHaveBeenCalled();
  });
});

describe("SongEntryControls album information button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to the album detail route for a linked entry", () => {
    renderWithProviders(
      <SongEntryControls
        entry={createTestFlowsheetEntry({ id: 60, album_id: 42 })}
        queue={false}
        editable={true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Album information" }));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/album/42");
  });

  it("stays disabled for an entry with no library linkage", () => {
    renderWithProviders(
      <SongEntryControls
        entry={createTestFlowsheetEntry({ id: 60, album_id: undefined })}
        queue={false}
        editable={true}
      />
    );

    expect(
      screen.getByRole("button", { name: "Album information" })
    ).toHaveProperty("disabled", true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
