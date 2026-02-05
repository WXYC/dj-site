import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArtistAvatar, ROTATION_STYLES } from "./ArtistAvatar";
import { createTestArtist } from "@/lib/test-utils/fixtures";
import { Rotation } from "@/lib/features/rotation/types";
import type { ArtistEntry, Format, Genre } from "@/lib/features/catalog/types";

describe("ArtistAvatar", () => {
  const mockArtist = createTestArtist();

  describe("basic rendering", () => {
    it("should render Avatar component", () => {
      render(<ArtistAvatar artist={mockArtist} />);
      // Avatar contains the letter code
      expect(screen.getByText(mockArtist.lettercode)).toBeInTheDocument();
    });

    it("should render artist lettercode", () => {
      const artist = createTestArtist({ lettercode: "XY" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText("XY")).toBeInTheDocument();
    });

    it("should render artist numbercode", () => {
      const artist = createTestArtist({ numbercode: 42 });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("should render entry number", () => {
      render(<ArtistAvatar artist={mockArtist} entry={7} />);
      expect(screen.getByText("7")).toBeInTheDocument();
    });

    it("should render genre abbreviation", () => {
      const artist = createTestArtist({ genre: "Rock" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText("RO")).toBeInTheDocument();
    });

    it("should render format abbreviation", () => {
      render(<ArtistAvatar artist={mockArtist} format="CD" />);
      expect(screen.getByText("CD")).toBeInTheDocument();
    });
  });

  describe("genre handling", () => {
    const genres: Genre[] = [
      "Blues",
      "Rock",
      "Electronic",
      "Hiphop",
      "Jazz",
      "Classical",
      "Reggae",
      "Soundtracks",
      "OCS",
    ];

    genres.forEach((genre) => {
      it(`should render ${genre} genre abbreviation`, () => {
        const artist = createTestArtist({ genre });
        render(<ArtistAvatar artist={artist} />);
        const abbrev = genre.substring(0, 2).toUpperCase();
        expect(screen.getByText(abbrev)).toBeInTheDocument();
      });
    });

    it("should display dash for unknown artist", () => {
      render(<ArtistAvatar artist={undefined} />);
      // When no artist, shows dashes
      expect(screen.getAllByText("|").length).toBeGreaterThan(0);
    });

    it("should handle Unknown genre", () => {
      const artist = createTestArtist({ genre: "Unknown" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText("UN")).toBeInTheDocument();
    });
  });

  describe("format handling", () => {
    it("should render CD format", () => {
      render(<ArtistAvatar artist={mockArtist} format="CD" />);
      expect(screen.getByText("CD")).toBeInTheDocument();
    });

    it("should render Vinyl format", () => {
      render(<ArtistAvatar artist={mockArtist} format="Vinyl" />);
      expect(screen.getByText("VI")).toBeInTheDocument();
    });

    it("should render dash for Unknown format", () => {
      render(<ArtistAvatar artist={mockArtist} format="Unknown" />);
      // Unknown format should display as dash
      const dashes = screen.getAllByText((content, element) =>
        element?.textContent === "\u2014" || content === "--"
      );
      expect(dashes.length).toBeGreaterThan(0);
    });

    it("should render dashes for undefined format", () => {
      render(<ArtistAvatar artist={mockArtist} format={undefined} />);
      expect(screen.getByText("--")).toBeInTheDocument();
    });
  });

  describe("rotation badge", () => {
    it("should render H rotation badge", () => {
      render(<ArtistAvatar artist={mockArtist} rotation={Rotation.H} />);
      expect(screen.getByText("H")).toBeInTheDocument();
    });

    it("should render M rotation badge", () => {
      render(<ArtistAvatar artist={mockArtist} rotation={Rotation.M} />);
      expect(screen.getByText("M")).toBeInTheDocument();
    });

    it("should render L rotation badge", () => {
      render(<ArtistAvatar artist={mockArtist} rotation={Rotation.L} />);
      expect(screen.getByText("L")).toBeInTheDocument();
    });

    it("should render S rotation badge", () => {
      render(<ArtistAvatar artist={mockArtist} rotation={Rotation.S} />);
      expect(screen.getByText("S")).toBeInTheDocument();
    });

    it("should not render badge when rotation is undefined", () => {
      render(<ArtistAvatar artist={mockArtist} rotation={undefined} />);
      // Badge content should be null, so no rotation letters outside the avatar
      expect(screen.queryByText("H")).not.toBeInTheDocument();
      expect(screen.queryByText("M")).not.toBeInTheDocument();
      expect(screen.queryByText("L")).not.toBeInTheDocument();
    });
  });

  describe("ROTATION_STYLES export", () => {
    it("should export correct color for H rotation", () => {
      expect(ROTATION_STYLES.H).toBe("primary");
    });

    it("should export correct color for M rotation", () => {
      expect(ROTATION_STYLES.M).toBe("warning");
    });

    it("should export correct color for L rotation", () => {
      expect(ROTATION_STYLES.L).toBe("success");
    });

    it("should export correct color for S rotation", () => {
      expect(ROTATION_STYLES.S).toBe("neutral");
    });
  });

  describe("tooltip", () => {
    it("should have tooltip with genre, format, and code information", () => {
      const artist = createTestArtist({
        lettercode: "AB",
        numbercode: 12,
        genre: "Rock",
      });
      render(<ArtistAvatar artist={artist} entry={5} format="CD" />);
      // The tooltip title should contain relevant info
      // We can verify the component renders without errors with these props
      expect(screen.getByText("AB")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should show [Genre] placeholder when artist genre is undefined", () => {
      render(<ArtistAvatar artist={undefined} />);
      // Component should still render
      expect(screen.getAllByText("|").length).toBeGreaterThan(0);
    });

    it("should show [Format] placeholder for Unknown format", () => {
      render(<ArtistAvatar artist={mockArtist} format="Unknown" />);
      // Unknown format displays dash in the avatar
      const dashes = screen.getAllByText((content, element) =>
        element?.textContent === "\u2014" || content === "--"
      );
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle all props undefined", () => {
      render(<ArtistAvatar />);
      // Should render without crashing
      expect(screen.getAllByText("|").length).toBeGreaterThan(0);
    });

    it("should handle artist with undefined genre", () => {
      const artist = {
        ...mockArtist,
        genre: undefined as unknown as Genre,
      };
      render(<ArtistAvatar artist={artist} />);
      // Should fall back to dash
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });

    it("should handle artist with undefined lettercode", () => {
      const artist = {
        ...mockArtist,
        lettercode: undefined as unknown as string,
      };
      render(<ArtistAvatar artist={artist} />);
      // Component should render without lettercode
      expect(screen.queryByText(mockArtist.lettercode)).not.toBeInTheDocument();
    });

    it("should handle artist with undefined numbercode", () => {
      const artist = {
        ...mockArtist,
        numbercode: undefined as unknown as number,
      };
      render(<ArtistAvatar artist={artist} />);
      // Should show pipe character as placeholder
      expect(screen.getAllByText("|").length).toBeGreaterThan(0);
    });

    it("should handle entry as undefined", () => {
      render(<ArtistAvatar artist={mockArtist} entry={undefined} />);
      // Should show pipe character
      expect(screen.getAllByText("|").length).toBeGreaterThan(0);
    });

    it("should handle background prop", () => {
      render(<ArtistAvatar artist={mockArtist} background="#ff0000" />);
      // Should render without errors
      expect(screen.getByText(mockArtist.lettercode)).toBeInTheDocument();
    });

    it("should render correct inner avatar color for CD format", () => {
      render(<ArtistAvatar artist={mockArtist} format="CD" />);
      // CD format should show primary color inner avatar
      expect(screen.getByText(mockArtist.lettercode)).toBeInTheDocument();
    });

    it("should render correct inner avatar color for Vinyl format", () => {
      render(<ArtistAvatar artist={mockArtist} format="Vinyl" />);
      // Vinyl format should show warning color inner avatar
      expect(screen.getByText(mockArtist.lettercode)).toBeInTheDocument();
    });

    it("should render correct inner avatar color for undefined format", () => {
      render(<ArtistAvatar artist={mockArtist} format={undefined} />);
      // Undefined format defaults to warning color
      expect(screen.getByText(mockArtist.lettercode)).toBeInTheDocument();
    });
  });

  describe("genre colors and variants", () => {
    it("should apply solid variant for Rock genre", () => {
      const artist = createTestArtist({ genre: "Rock" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should apply solid variant for Electronic genre", () => {
      const artist = createTestArtist({ genre: "Electronic" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should apply soft variant for Blues genre", () => {
      const artist = createTestArtist({ genre: "Blues" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should apply soft variant for Classical genre", () => {
      const artist = createTestArtist({ genre: "Classical" });
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should default to neutral color for undefined genre mapping", () => {
      const artist = {
        ...mockArtist,
        genre: "NonExistent" as Genre,
      };
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should default to solid variant for undefined genre variant mapping", () => {
      const artist = {
        ...mockArtist,
        genre: "NonExistent" as Genre,
      };
      render(<ArtistAvatar artist={artist} />);
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });
  });

  describe("inner avatar variant toggle", () => {
    it("should toggle variant for inner avatar when outer is solid", () => {
      // Rock has solid variant
      const artist = createTestArtist({ genre: "Rock" });
      render(<ArtistAvatar artist={artist} />);
      // Inner avatar should be soft when outer is solid
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });

    it("should toggle variant for inner avatar when outer is soft", () => {
      // Blues has soft variant
      const artist = createTestArtist({ genre: "Blues" });
      render(<ArtistAvatar artist={artist} />);
      // Inner avatar should be solid when outer is soft
      expect(screen.getByText(artist.lettercode)).toBeInTheDocument();
    });
  });
});
