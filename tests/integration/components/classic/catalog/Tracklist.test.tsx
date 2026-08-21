import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

const mockCompilationTracks = vi.fn();
const mockLibraryTracks = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return { ...actual, useGetCompilationTracksQuery: (...a: unknown[]) => mockCompilationTracks(...a) };
});
vi.mock("@/lib/features/metadata/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/metadata/api")>();
  return { ...actual, useGetLibraryTracksQuery: (...a: unknown[]) => mockLibraryTracks(...a) };
});

import Tracklist from "@/src/components/experiences/classic/catalog/Tracklist";

const empty = { data: undefined, isLoading: false };

describe("Classic Tracklist", () => {
  it("renders a Discogs-sourced tracklist in two columns", () => {
    mockCompilationTracks.mockReturnValue(empty);
    mockLibraryTracks.mockReturnValue({
      data: {
        library_id: 65879,
        discogs_release_id: 41,
        source: "discogs",
        tracks: [
          { position: "1", title: "Rpeg", artist_credit: "Autechre", duration_ms: null },
          { position: "2", title: "Ccec", artist_credit: "Autechre", duration_ms: null },
        ],
      },
      isLoading: false,
    });

    renderWithProviders(
      <Tracklist albumId={53380} legacyReleaseId={65879} variousArtists={false} />
    );

    expect(screen.getByText("Tracklist")).toBeDefined();
    expect(screen.getByText("Rpeg")).toBeDefined();
    // Not various-artists: no artist column, so the header spans two.
    expect(screen.getByText("Tracklist").getAttribute("colspan")).toBe("2");
  });

  it("adds the artist column only for a compilation that names artists", () => {
    mockCompilationTracks.mockReturnValue({
      data: {
        library_id: 9001,
        tracks: [
          { id: 1, artist_name: "Chuquimamani-Condori", track_title: "Call Your Name", track_position: "A1" },
        ],
      },
      isLoading: false,
    });
    mockLibraryTracks.mockReturnValue(empty);

    renderWithProviders(
      <Tracklist albumId={9001} legacyReleaseId={9001} variousArtists={true} />
    );

    expect(screen.getByText("Tracklist").getAttribute("colspan")).toBe("3");
    expect(screen.getByText("Chuquimamani-Condori")).toBeDefined();
  });

  it("shows the legacy empty copy when neither source has rows", () => {
    mockCompilationTracks.mockReturnValue(empty);
    mockLibraryTracks.mockReturnValue({
      data: { library_id: 65879, discogs_release_id: null, source: null, tracks: [] },
      isLoading: false,
    });

    renderWithProviders(
      <Tracklist albumId={53380} legacyReleaseId={65879} variousArtists={false} />
    );

    expect(screen.getByText("No tracklist available.")).toBeDefined();
  });

  it("skips the Discogs source rather than querying it with a placeholder id", () => {
    mockCompilationTracks.mockReturnValue(empty);
    mockLibraryTracks.mockReturnValue(empty);

    renderWithProviders(
      <Tracklist albumId={53380} legacyReleaseId={null} variousArtists={false} />
    );

    // The id spaces differ and a wrong id returns an unrelated release's
    // tracklist with a 200, so an absent legacy id must skip, not guess.
    expect(mockLibraryTracks).toHaveBeenCalledWith(null, expect.objectContaining({ skip: true }));
  });
});
