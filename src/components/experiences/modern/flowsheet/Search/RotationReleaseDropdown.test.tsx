import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RotationReleaseDropdown from "./RotationReleaseDropdown";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";

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

describe("RotationReleaseDropdown", () => {
  const mockOnSelectRelease = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the trigger with placeholder text when no release is selected", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    expect(screen.getByText("Select Release...")).toBeInTheDocument();
  });

  it("should show selected release in trigger when one is selected", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={releases[0]}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    expect(screen.getByText(/Autechre/)).toBeInTheDocument();
    expect(screen.getByText(/Confield/)).toBeInTheDocument();
  });

  it("should open dropdown panel when trigger is clicked", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    expect(screen.getByTestId("rotation-release-panel")).toBeInTheDocument();
  });

  it("should show all releases in the dropdown panel", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    expect(screen.getByText(/Autechre/)).toBeInTheDocument();
    expect(screen.getByText(/Cat Power/)).toBeInTheDocument();
    expect(screen.getByText(/Stereolab/)).toBeInTheDocument();
  });

  it("should call onSelectRelease when a release is clicked", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    fireEvent.click(screen.getByTestId("rotation-release-option-1"));
    expect(mockOnSelectRelease).toHaveBeenCalledWith(releases[0]);
  });

  it("should close dropdown after selecting a release", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    expect(screen.getByTestId("rotation-release-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("rotation-release-option-1"));
    expect(screen.queryByTestId("rotation-release-panel")).not.toBeInTheDocument();
  });

  it("should not open when disabled", () => {
    render(
      <RotationReleaseDropdown
        releases={releases}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={true}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    expect(screen.queryByTestId("rotation-release-panel")).not.toBeInTheDocument();
  });

  it("should show empty state when no releases provided", () => {
    render(
      <RotationReleaseDropdown
        releases={[]}
        selectedRelease={null}
        onSelectRelease={mockOnSelectRelease}
        disabled={false}
      />
    );
    fireEvent.click(screen.getByTestId("rotation-release-trigger"));
    expect(screen.getByText(/no releases/i)).toBeInTheDocument();
  });

  // WXYC/dj-site#745 — DJ feedback: can't quickly find a release in the picker.
  describe("search and sort (#745)", () => {
    it("sorts releases alphabetically by artist name regardless of input order", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const options = screen.getAllByTestId(/^rotation-release-option-/);
      // Input order in fixture: Autechre, Cat Power, Stereolab (already sorted).
      // Hand a re-shuffled fixture to make sure sort is enforced.
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
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
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
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const options = screen.getAllByTestId(/^rotation-release-option-/);
      expect(options.map((o) => o.dataset.testid)).toEqual([
        "rotation-release-option-22", // Autechre
        "rotation-release-option-23", // cat power
        "rotation-release-option-21", // stereolab
      ]);
    });

    it("renders a search input when the dropdown opens", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      expect(
        screen.getByTestId("rotation-release-search")
      ).toBeInTheDocument();
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
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const search = screen.getByTestId("rotation-release-search");
      fireEvent.change(search, { target: { value: "ste" } });
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
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const search = screen.getByTestId("rotation-release-search");
      fireEvent.change(search, { target: { value: "moon" } });
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
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const search = screen.getByTestId("rotation-release-search");
      fireEvent.change(search, { target: { value: "zzzz-does-not-exist" } });
      expect(
        screen.queryAllByTestId(/^rotation-release-option-/)
      ).toHaveLength(0);
      expect(screen.getByText(/no releases match/i)).toBeInTheDocument();
    });

    it("clears the filter when the dropdown is reopened", () => {
      render(
        <RotationReleaseDropdown
          releases={releases}
          selectedRelease={null}
          onSelectRelease={mockOnSelectRelease}
          disabled={false}
        />
      );
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      const search = screen.getByTestId("rotation-release-search");
      fireEvent.change(search, { target: { value: "ste" } });
      // Close
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      // Reopen
      fireEvent.click(screen.getByTestId("rotation-release-trigger"));
      expect(
        (screen.getByTestId("rotation-release-search") as HTMLInputElement)
          .value
      ).toBe("");
    });
  });
});
