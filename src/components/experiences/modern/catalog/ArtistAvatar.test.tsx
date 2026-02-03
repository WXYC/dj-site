import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtistAvatar, ROTATION_STYLES } from "./ArtistAvatar";
import type { ArtistEntry } from "@/lib/features/catalog/types";

describe("ArtistAvatar", () => {
  const mockArtist: ArtistEntry = {
    id: 1,
    lettercode: "AB",
    numbercode: 123,
    artist: "Test Artist",
    genre: "Rock",
  };

  it("should render with basic props", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} />);

    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("should display artist lettercode", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} />);

    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("should display artist numbercode", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} />);

    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("should display entry number", () => {
    render(<ArtistAvatar artist={mockArtist} entry={5} />);

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should display format abbreviation for CD", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} format="CD" />);

    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  it("should display format abbreviation for Vinyl", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} format="Vinyl" />);

    expect(screen.getByText("VI")).toBeInTheDocument();
  });

  it("should display dash for Unknown format", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} format="Unknown" />);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("should display genre abbreviation", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} />);

    expect(screen.getByText("RO")).toBeInTheDocument(); // First 2 chars of "Rock"
  });

  it("should handle undefined artist gracefully", () => {
    render(<ArtistAvatar entry={1} />);

    // Should render without crashing
    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("should render rotation badge when provided", () => {
    render(<ArtistAvatar artist={mockArtist} entry={1} rotation="H" />);

    expect(screen.getByText("H")).toBeInTheDocument();
  });

  it("should have correct rotation styles for all rotations", () => {
    expect(ROTATION_STYLES.H).toBe("primary");
    expect(ROTATION_STYLES.M).toBe("warning");
    expect(ROTATION_STYLES.L).toBe("success");
    expect(ROTATION_STYLES.S).toBe("neutral");
  });

  it("should handle Electronic genre", () => {
    const electronicArtist: ArtistEntry = {
      ...mockArtist,
      genre: "Electronic",
    };
    render(<ArtistAvatar artist={electronicArtist} entry={1} />);

    expect(screen.getByText("EL")).toBeInTheDocument();
  });

  it("should handle Jazz genre", () => {
    const jazzArtist: ArtistEntry = {
      ...mockArtist,
      genre: "Jazz",
    };
    render(<ArtistAvatar artist={jazzArtist} entry={1} />);

    expect(screen.getByText("JA")).toBeInTheDocument();
  });

  it("should handle Blues genre", () => {
    const bluesArtist: ArtistEntry = {
      ...mockArtist,
      genre: "Blues",
    };
    render(<ArtistAvatar artist={bluesArtist} entry={1} />);

    expect(screen.getByText("BL")).toBeInTheDocument();
  });

  it("should handle Classical genre", () => {
    const classicalArtist: ArtistEntry = {
      ...mockArtist,
      genre: "Classical",
    };
    render(<ArtistAvatar artist={classicalArtist} entry={1} />);

    expect(screen.getByText("CL")).toBeInTheDocument();
  });

  it("should handle Unknown genre gracefully", () => {
    const unknownArtist: ArtistEntry = {
      ...mockArtist,
      genre: undefined as any,
    };
    render(<ArtistAvatar artist={unknownArtist} entry={1} />);

    // Should render without crashing
    expect(document.body.querySelector(".MuiAvatar-root")).toBeInTheDocument();
  });
});
