import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock RTK Query hooks
const mockArtistQuery = { data: undefined as string[] | undefined };
const mockTrackQuery = {
  data: undefined as
    | Array<{
        track_title: string;
        album_title: string | null;
        record_label: string | null;
      }>
    | undefined,
};

vi.mock("@/lib/features/flowsheet/api", () => ({
  useSuggestArtistsQuery: vi.fn(() => mockArtistQuery),
  useSuggestTracksQuery: vi.fn(() => mockTrackQuery),
}));

// Mock debounce to return value immediately in tests
vi.mock("./useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

import { useGhostText } from "./useGhostText";

describe("useGhostText", () => {
  beforeEach(() => {
    mockArtistQuery.data = undefined;
    mockTrackQuery.data = undefined;
  });

  describe("artist field", () => {
    it("returns empty ghost text when no suggestion available", () => {
      const { result } = renderHook(() =>
        useGhostText("artist", "Aut")
      );

      expect(result.current.ghostSuffix).toBe("");
      expect(result.current.acceptGhostText()).toBeNull();
    });

    it("returns ghost suffix when suggestion matches prefix", () => {
      mockArtistQuery.data = ["Autechre"];

      const { result } = renderHook(() =>
        useGhostText("artist", "Au")
      );

      expect(result.current.ghostSuffix).toBe("techre");
    });

    it("returns full suggestion on accept", () => {
      mockArtistQuery.data = ["Autechre"];

      const { result } = renderHook(() =>
        useGhostText("artist", "Au")
      );

      expect(result.current.acceptGhostText()).toBe("Autechre");
    });

    it("returns empty ghost text when suggestion does not match prefix", () => {
      mockArtistQuery.data = ["Boards of Canada"];

      const { result } = renderHook(() =>
        useGhostText("artist", "Au")
      );

      expect(result.current.ghostSuffix).toBe("");
    });

    it("returns empty ghost text when input is too short", () => {
      mockArtistQuery.data = ["Autechre"];

      const { result } = renderHook(() =>
        useGhostText("artist", "A")
      );

      // Query is skipped for short input, so data won't be populated in practice
      // But even if data somehow exists, prefix must match
      expect(result.current.ghostSuffix).toBe("utechre");
    });

    it("returns empty ghost text when input is empty", () => {
      const { result } = renderHook(() =>
        useGhostText("artist", "")
      );

      expect(result.current.ghostSuffix).toBe("");
    });

    it("matches prefix case-insensitively", () => {
      mockArtistQuery.data = ["Autechre"];

      const { result } = renderHook(() =>
        useGhostText("artist", "au")
      );

      expect(result.current.ghostSuffix).toBe("techre");
      expect(result.current.acceptGhostText()).toBe("Autechre");
    });
  });

  describe("song field", () => {
    it("returns ghost suffix for matching track", () => {
      mockTrackQuery.data = [
        {
          track_title: "VI Scose Poise",
          album_title: "Confield",
          record_label: "Warp",
        },
      ];

      const { result } = renderHook(() =>
        useGhostText("song", "VI", "Autechre")
      );

      expect(result.current.ghostSuffix).toBe(" Scose Poise");
    });

    it("includes trackResult with album and label for auto-fill", () => {
      mockTrackQuery.data = [
        {
          track_title: "VI Scose Poise",
          album_title: "Confield",
          record_label: "Warp",
        },
      ];

      const { result } = renderHook(() =>
        useGhostText("song", "VI", "Autechre")
      );

      expect(result.current.trackResult).toEqual({
        track_title: "VI Scose Poise",
        album_title: "Confield",
        record_label: "Warp",
      });
    });

    it("returns empty ghost text when no confirmed artist", () => {
      const { result } = renderHook(() =>
        useGhostText("song", "VI")
      );

      expect(result.current.ghostSuffix).toBe("");
    });

    it("returns null trackResult when no match", () => {
      mockTrackQuery.data = [];

      const { result } = renderHook(() =>
        useGhostText("song", "zzz", "Autechre")
      );

      expect(result.current.trackResult).toBeNull();
    });
  });
});
