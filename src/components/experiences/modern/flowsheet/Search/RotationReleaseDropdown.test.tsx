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
});
