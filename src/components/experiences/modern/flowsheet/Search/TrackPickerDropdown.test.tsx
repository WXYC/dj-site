import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TrackPickerDropdown, {
  TrackPickerEntry,
} from "./TrackPickerDropdown";

const tracks: TrackPickerEntry[] = [
  { position: "A1", title: "Percolator", artists: ["Stereolab"] },
  { position: "A2", title: "Cybele's Reverie", artists: ["Stereolab"] },
  { position: "B1", title: "Anonymous Collective", artists: ["Stereolab"] },
];

function getCombobox(): HTMLInputElement {
  return screen.getByTestId("track-picker-combobox") as HTMLInputElement;
}

describe("TrackPickerDropdown — combobox (#745)", () => {
  const onSelectTrack = vi.fn();
  const onManualEntry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger as an editable combobox with placeholder text when nothing is selected", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    expect(input.tagName).toBe("INPUT");
    expect(input.placeholder).toMatch(/select track|song title/i);
    expect(input.value).toBe("");
  });

  it("shows the selected track title only when the panel is closed (position stays in the panel)", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={tracks[0]}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    expect(getCombobox().value).toBe("Percolator");
  });

  it("opens the panel on focus", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    expect(screen.getByTestId("track-picker-panel")).toBeInTheDocument();
  });

  it("shows every track when nothing has been typed, preserving tracklist order", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    const options = screen.getAllByTestId(/^track-picker-option-/);
    // Tracklist order (A1, A2, B1) — do NOT alphabetize. Disc/side order is
    // the DJ's mental model.
    expect(options.map((o) => o.dataset.testid)).toEqual([
      "track-picker-option-0",
      "track-picker-option-1",
      "track-picker-option-2",
    ]);
  });

  it("filters tracks by title as the DJ types (case-insensitive)", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "perc" } });
    expect(
      screen.queryByTestId("track-picker-option-0")
    ).toBeInTheDocument(); // Percolator
    expect(
      screen.queryByTestId("track-picker-option-1")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("track-picker-option-2")
    ).not.toBeInTheDocument();
  });

  it("filters by per-track artist credit too", () => {
    const va: TrackPickerEntry[] = [
      { position: "A1", title: "Track One", artists: ["Coil"] },
      { position: "A2", title: "Track Two", artists: ["Nurse With Wound"] },
      { position: "B1", title: "Track Three", artists: ["Current 93"] },
    ];
    render(
      <TrackPickerDropdown
        tracks={va}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "nurse" } });
    expect(
      screen.queryByTestId("track-picker-option-1")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("track-picker-option-0")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("track-picker-option-2")
    ).not.toBeInTheDocument();
  });

  it("filters by track position (e.g. 'A1', 'B2')", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "B1" } });
    expect(
      screen.queryByTestId("track-picker-option-2")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("track-picker-option-0")
    ).not.toBeInTheDocument();
  });

  it("calls onSelectTrack and closes when an option is clicked", () => {
    const { rerender } = render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    fireEvent.click(screen.getByTestId("track-picker-option-1"));
    expect(onSelectTrack).toHaveBeenCalledWith(tracks[1]);
    rerender(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={tracks[1]}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    expect(
      screen.queryByTestId("track-picker-panel")
    ).not.toBeInTheDocument();
    expect(getCombobox().value).toBe("Cybele's Reverie");
  });

  it("always shows the 'Not listed — enter manually' option, even when the filter eliminates every track", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzz-nothing" } });
    expect(
      screen.queryAllByTestId(/^track-picker-option-/)
    ).toHaveLength(0);
    expect(screen.getByTestId("track-picker-manual")).toBeInTheDocument();
  });

  it("calls onManualEntry when the manual-entry option is clicked", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    fireEvent.click(screen.getByTestId("track-picker-manual"));
    expect(onManualEntry).toHaveBeenCalledTimes(1);
  });

  it("disables the combobox when disabled prop is true", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={true}
      />
    );
    expect(getCombobox().disabled).toBe(true);
    fireEvent.click(getCombobox());
    expect(
      screen.queryByTestId("track-picker-panel")
    ).not.toBeInTheDocument();
  });

  it("disables the combobox while loading and surfaces a loading hint", () => {
    render(
      <TrackPickerDropdown
        tracks={[]}
        isLoading={true}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    const input = getCombobox();
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toMatch(/loading/i);
  });

  it("falls back to a 'Song Title' placeholder when no tracks are available and not loading", () => {
    render(
      <TrackPickerDropdown
        tracks={[]}
        isLoading={false}
        selectedTrack={null}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    expect(getCombobox().placeholder).toMatch(/song title/i);
  });

  it("starts a fresh filter on each focus rather than keeping the selected track's text as a filter", () => {
    render(
      <TrackPickerDropdown
        tracks={tracks}
        isLoading={false}
        selectedTrack={tracks[0]}
        onSelectTrack={onSelectTrack}
        onManualEntry={onManualEntry}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    expect(screen.getAllByTestId(/^track-picker-option-/)).toHaveLength(3);
  });
});
