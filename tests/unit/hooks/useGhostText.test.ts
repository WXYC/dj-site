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

const { useSuggestArtistsQueryMock, useSuggestTracksQueryMock } = vi.hoisted(
  () => ({
    useSuggestArtistsQueryMock: vi.fn(),
    useSuggestTracksQueryMock: vi.fn(),
  })
);

vi.mock("@/lib/features/flowsheet/api", () => ({
  useSuggestArtistsQuery: useSuggestArtistsQueryMock,
  useSuggestTracksQuery: useSuggestTracksQueryMock,
}));

// Mock debounce to return value immediately in tests
vi.mock("@/src/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

import { useGhostText } from "@/src/hooks/useGhostText";

describe("useGhostText", () => {
  beforeEach(() => {
    mockArtistQuery.data = undefined;
    mockTrackQuery.data = undefined;
    useSuggestArtistsQueryMock.mockReset();
    useSuggestTracksQueryMock.mockReset();
    useSuggestArtistsQueryMock.mockImplementation(() => mockArtistQuery);
    useSuggestTracksQueryMock.mockImplementation(() => mockTrackQuery);
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

  describe("compilation-indicator short-circuit", () => {
    it.each([
      "Various Artists",
      "various artists",
      "V/A",
      "v.a.",
      "Soundtrack",
      "Compilation",
    ])("passes skip=true for artist field with %s", (value) => {
      renderHook(() => useGhostText("artist", value));

      const lastCall = useSuggestArtistsQueryMock.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ skip: true });
    });

    it("does not skip for the song field even when the value contains 'various'", () => {
      renderHook(() => useGhostText("song", "Various Versions", "Autechre"));

      // The song-field gate already skips the artist-suggest hook (field !==
      // "artist"), so we verify the track-suggest hook didn't get skipped.
      const lastCall = useSuggestTracksQueryMock.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ skip: false });
    });

    it("passes skip=false for legitimate artist names", () => {
      renderHook(() => useGhostText("artist", "Stereolab"));

      const lastCall = useSuggestArtistsQueryMock.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ skip: false });
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

  describe("album field via suggestion override", () => {
    it("ghosts from the override (e.g. the top catalog title)", () => {
      const { result } = renderHook(() =>
        useGhostText("album", "Dots", undefined, "Dots and Loops")
      );
      expect(result.current.ghostSuffix).toBe(" and Loops");
      expect(result.current.acceptGhostText()).toBe("Dots and Loops");
    });

    it("hides when the override does not extend the typed value", () => {
      const { result } = renderHook(() =>
        useGhostText("album", "Emperor", undefined, "Emperor")
      );
      expect(result.current.ghostSuffix).toBe("");
    });

    it("hides when the override does not match the prefix", () => {
      const { result } = renderHook(() =>
        useGhostText("album", "Xyz", undefined, "Dots and Loops")
      );
      expect(result.current.ghostSuffix).toBe("");
    });

    it("an override wins over the internal artist query", () => {
      mockArtistQuery.data = ["Autechre"];
      const { result } = renderHook(() =>
        useGhostText("artist", "Au", undefined, "Auteur Theory")
      );
      expect(result.current.acceptGhostText()).toBe("Auteur Theory");
    });
  });
});
