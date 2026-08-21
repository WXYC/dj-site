import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";

const mockArtistCard = vi.fn();
const mockArtistReleases = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetArtistCardQuery: (...args: unknown[]) => mockArtistCard(...args),
    useGetArtistReleasesQuery: (...args: unknown[]) => mockArtistReleases(...args),
    useGetGenresQuery: () => ({ data: [{ id: 15, genre_name: "Electronic" }] }),
  };
});

import ArtistCardView from "@/src/components/experiences/classic/catalog/ArtistCardView";

const artist = {
  artist_id: 19516,
  artist_name: "Autechre",
  alphabetical_name: "Autechre",
  genre_id: 15,
  code_letters: "AU",
  code_artist_number: 3,
};

const release = (over = {}) => ({
  id: 53375,
  last_modified: "2016-10-29T16:28:00.254Z",
  format_name: "cd",
  genre_id: 15,
  code_letters: "AU",
  code_artist_number: 3,
  code_number: 1,
  code_volume_letters: null,
  album_title: "Tri Repetae",
  alternate_artist_name: null,
  ...over,
});

describe("Classic ArtistCardView", () => {
  it("renders the JSP's header: code, name, and release count", () => {
    mockArtistCard.mockReturnValue({ data: artist, isLoading: false, isError: false });
    mockArtistReleases.mockReturnValue({
      data: { artist_id: 19516, releases: [release()], total: 1, page: 0, totalPages: 1 },
      isLoading: false,
    });

    renderWithProviders(<ArtistCardView artistId={19516} />);

    expect(screen.getByTestId("artist-view-code").textContent).toContain("Electronic AU 3");
    // Twice on purpose: the card's own heading, and the release row's artist
    // cell — which the JSP prints per-release, so they diverge on a
    // compilation or an alternate-artist row.
    expect(screen.getAllByText("Autechre")).toHaveLength(2);
    expect(screen.getByText("# of releases: 1")).toBeDefined();
  });

  it("links each release title to the release screen", () => {
    mockArtistCard.mockReturnValue({ data: artist, isLoading: false, isError: false });
    mockArtistReleases.mockReturnValue({
      data: { artist_id: 19516, releases: [release()], total: 1, page: 0, totalPages: 1 },
      isLoading: false,
    });

    renderWithProviders(<ArtistCardView artistId={19516} />);

    expect(screen.getByRole("link", { name: "Tri Repetae" }).getAttribute("href")).toBe(
      "/dashboard/library/release/53375"
    );
  });

  it("renders the JSP's empty state verbatim", () => {
    mockArtistCard.mockReturnValue({ data: artist, isLoading: false, isError: false });
    mockArtistReleases.mockReturnValue({
      data: { artist_id: 19516, releases: [], total: 0, page: 0, totalPages: 0 },
      isLoading: false,
    });

    renderWithProviders(<ArtistCardView artistId={19516} />);

    expect(screen.getByText("The artist does not have any library releases.")).toBeDefined();
  });

  it("surfaces a load failure rather than an empty card", () => {
    mockArtistCard.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockArtistReleases.mockReturnValue({ data: undefined, isLoading: false });

    renderWithProviders(<ArtistCardView artistId={1} />);

    expect(screen.getByTestId("artist-view-error")).toBeDefined();
  });
});
