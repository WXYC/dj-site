import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RotationReleaseDropdown from "./RotationReleaseDropdown";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import type { AlbumEntry } from "@/lib/features/catalog/types";

const releases = [
  createTestAlbum({
    id: 1,
    title: "Confield",
    artist: createTestArtist({ name: "Autechre" }),
    label: "Warp",
  }),
  createTestAlbum({
    id: 2,
    title: "Moon Pix",
    artist: createTestArtist({ name: "Cat Power" }),
    label: "Matador Records",
  }),
  createTestAlbum({
    id: 3,
    title: "Aluminum Tunes",
    artist: createTestArtist({ name: "Stereolab" }),
    label: "Duophonic",
  }),
];

function getCombobox(): HTMLInputElement {
  return screen.getByTestId("rotation-release-combobox") as HTMLInputElement;
}

describe("RotationReleaseDropdown — combobox (#745)", () => {
  const mockOnSelectRelease = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger as an editable combobox with placeholder text when nothing is selected", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    const input = getCombobox();
    expect(input.tagName).toBe("INPUT");
    expect(input.placeholder).toMatch(/select release/i);
    expect(input.value).toBe("");
  });

  it("shows the selected release as 'Artist — Title' in the trigger when the panel is closed", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={releases[0]}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    expect(getCombobox().value).toBe("Autechre — Confield");
  });

  it("opens the panel when the combobox is focused", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    expect(screen.getByTestId("rotation-release-panel")).toBeInTheDocument();
  });

  it("opens the panel when the combobox is clicked even if already focused", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(getCombobox());
    expect(screen.getByTestId("rotation-release-panel")).toBeInTheDocument();
  });

  it("shows all releases in the dropdown panel when nothing has been typed", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    expect(screen.getByText(/Autechre/)).toBeInTheDocument();
    expect(screen.getByText(/Cat Power/)).toBeInTheDocument();
    expect(screen.getByText(/Stereolab/)).toBeInTheDocument();
  });

  it("calls onSelectRelease when an option is clicked", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    fireEvent.click(screen.getByTestId("rotation-release-option-1"));
    expect(mockOnSelectRelease).toHaveBeenCalledWith(releases[0]);
  });

  it("closes the panel and reflects the selection in the input after picking", () => {
    const { rerender } = render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    fireEvent.click(screen.getByTestId("rotation-release-option-3"));
    // Parent owns the selectedRelease state — simulate the controlled rerender.
    rerender(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={releases[2]}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    expect(
      screen.queryByTestId("rotation-release-panel")
    ).not.toBeInTheDocument();
    expect(getCombobox().value).toBe("Stereolab — Aluminum Tunes");
  });

  it("disables the combobox when disabled prop is true", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={true}
      />
    );
    const input = getCombobox();
    expect(input.disabled).toBe(true);
    fireEvent.click(input);
    expect(
      screen.queryByTestId("rotation-release-panel")
    ).not.toBeInTheDocument();
  });

  it("shows empty state when no releases provided", () => {
    render(
      <RotationReleaseDropdown
        releases={[]}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.focus(getCombobox());
    expect(screen.getByText(/no releases/i)).toBeInTheDocument();
  });

  describe("search and sort", () => {
    it("sorts releases alphabetically by artist name regardless of input order", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.focus(getCombobox());
      const options = screen.getAllByTestId(/^rotation-release-option-/);
      expect(options.map((o) => o.dataset.testid)).toEqual([
        "rotation-release-option-1", // Autechre
        "rotation-release-option-2", // Cat Power
        "rotation-release-option-3", // Stereolab
      ]);
    });

    it("breaks artist-name ties by album title", () => {
      const sameArtist = [
        createTestAlbum({
          id: 11,
          title: "Mars Audiac Quintet",
          artist: createTestArtist({ name: "Stereolab" }),
          label: "Elektra",
        }),
        createTestAlbum({
          id: 12,
          title: "Aluminum Tunes",
          artist: createTestArtist({ name: "Stereolab" }),
          label: "Duophonic",
        }),
        createTestAlbum({
          id: 13,
          title: "Emperor Tomato Ketchup",
          artist: createTestArtist({ name: "Stereolab" }),
          label: "Duophonic",
        }),
      ];
      render(
        <RotationReleaseDropdown
          releases={sameArtist}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.focus(getCombobox());
      const options = screen.getAllByTestId(/^rotation-release-option-/);
      expect(options.map((o) => o.dataset.testid)).toEqual([
        "rotation-release-option-12", // Aluminum Tunes
        "rotation-release-option-13", // Emperor Tomato Ketchup
        "rotation-release-option-11", // Mars Audiac Quintet
      ]);
    });

    it("sort is case-insensitive on artist name", () => {
      const mixedCase = [
        createTestAlbum({
          id: 21,
          title: "Album Z",
          artist: createTestArtist({ name: "stereolab" }),
        }),
        createTestAlbum({
          id: 22,
          title: "Album A",
          artist: createTestArtist({ name: "Autechre" }),
        }),
        createTestAlbum({
          id: 23,
          title: "Album B",
          artist: createTestArtist({ name: "cat power" }),
        }),
      ];
      render(
        <RotationReleaseDropdown
          releases={mixedCase}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.focus(getCombobox());
      const options = screen.getAllByTestId(/^rotation-release-option-/);
      expect(options.map((o) => o.dataset.testid)).toEqual([
        "rotation-release-option-22", // Autechre
        "rotation-release-option-23", // cat power
        "rotation-release-option-21", // stereolab
      ]);
    });

    it("filters the visible releases by artist name as the DJ types (case-insensitive substring)", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "ste" } });
      expect(
        screen.queryByTestId("rotation-release-option-3")
      ).toBeInTheDocument(); // Stereolab
      expect(
        screen.queryByTestId("rotation-release-option-1")
      ).not.toBeInTheDocument(); // Autechre filtered out
      expect(
        screen.queryByTestId("rotation-release-option-2")
      ).not.toBeInTheDocument(); // Cat Power filtered out
    });

    it("filters by album title too", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "moon" } });
      expect(
        screen.queryByTestId("rotation-release-option-2")
      ).toBeInTheDocument(); // Moon Pix
      expect(
        screen.queryByTestId("rotation-release-option-1")
      ).not.toBeInTheDocument();
    });

    it("shows a 'no matches' state when the filter eliminates everything", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "zzzz-does-not-exist" } });
      expect(
        screen.queryAllByTestId(/^rotation-release-option-/)
      ).toHaveLength(0);
      expect(screen.getByText(/no releases match/i)).toBeInTheDocument();
    });

    it("re-shows all releases when the user clears the filter", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "ste" } });
      fireEvent.change(input, { target: { value: "" } });
      expect(
        screen.queryAllByTestId(/^rotation-release-option-/)
      ).toHaveLength(3);
    });

    it("starts a fresh filter on each focus rather than keeping the selected release's text as a filter", () => {
      // Without resetting, the selected release's formatted text (e.g.
      // "Autechre — Confield") would be applied as a substring filter on next
      // focus and hide every other release.
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={releases[0]}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      // All three should be visible because the panel-open state filter is the
      // empty query, not the selected release's formatted display value.
      expect(screen.getAllByTestId(/^rotation-release-option-/)).toHaveLength(
        3
      );
    });

    it("does not clear the live filter when the input is clicked while the panel is already open", () => {
      // Regression: clicking inside an already-focused input fires `onClick`
      // again. The trigger's `onClick={openPanel}` must be idempotent so the
      // DJ's in-progress filter doesn't get wiped when they reposition the
      // caret mid-edit.
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      const input = getCombobox();
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "ste" } });
      // Filter is applied: Stereolab visible, others hidden.
      expect(
        screen.queryByTestId("rotation-release-option-3")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("rotation-release-option-1")
      ).not.toBeInTheDocument();

      // Click the (already-focused, already-open) input — must NOT reset the
      // query.
      fireEvent.click(input);
      expect(input.value).toBe("ste");
      expect(
        screen.queryByTestId("rotation-release-option-3")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("rotation-release-option-1")
      ).not.toBeInTheDocument();
    });
  });
});

// Regression: a library-unlinked rotation release can arrive with no `artist`
// object. formatRelease (the combobox value), matchesQuery (the type-ahead
// filter), and the option render all dereferenced `release.artist.name`
// unguarded — any one throws mid-render and bubbles to app/global-error,
// white-screening the page. Same null-artist class as the FlowsheetBackendResult
// and filterBySearchTerms guards.
describe("RotationReleaseDropdown — null artist (regression)", () => {
  const onSelect = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  const nullArtist = {
    ...createTestAlbum({ id: 9, title: "Untitled" }),
    artist: null,
  } as unknown as AlbumEntry;

  // A real bin holds more than one release, so the panel runs the list through
  // `sortRotationReleases` — whose comparator dereferences `artist.name`.
  // `Array.sort` skips the comparator for a 0/1-element array, so a single
  // null-artist release would dodge that crash path; pair it with a normal
  // release to exercise the sort.
  const goodRelease = createTestAlbum({
    id: 1,
    title: "Confield",
    artist: createTestArtist({ name: "Autechre" }),
  });

  it("renders a selected null-artist release in the trigger without throwing", () => {
    expect(() =>
      render(
        <RotationReleaseDropdown
          releases={[]}
          selectedRelease={nullArtist}
          onSelectRelease={onSelect}
          disabled={false}
        />
      )
    ).not.toThrow();
    expect(getCombobox().value).toBe(" — Untitled");
  });

  it("opens, sorts, and filters a list containing a null-artist release without throwing", () => {
    render(
      <RotationReleaseDropdown
        releases={[goodRelease, nullArtist]}
        selectedRelease={null}
        onSelectRelease={onSelect}
        disabled={false}
      />
    );
    expect(() => {
      fireEvent.focus(getCombobox()); // sortRotationReleases comparator + option render
      fireEvent.change(getCombobox(), { target: { value: "unt" } }); // matchesQuery
    }).not.toThrow();
    expect(screen.getByTestId("rotation-release-panel")).toBeInTheDocument();
  });
});
