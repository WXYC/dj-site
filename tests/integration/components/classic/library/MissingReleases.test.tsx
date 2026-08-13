import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockUseMissingReleases = vi.fn();
const mockMarkFound = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useMissingReleases: () => mockUseMissingReleases(),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useMarkFoundMutation: () => [mockMarkFound],
  };
});

import MissingReleases from "@/src/components/experiences/classic/library/MissingReleases";

describe("Classic MissingReleases — missingReleases.jsp", () => {
  it("shows the empty state and a zero total when there are no missing releases", () => {
    mockUseMissingReleases.mockReturnValue({
      results: [],
      total: 0,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("There are currently no missing releases.")).toBeDefined();
    expect(screen.getByText("Total missing: 0")).toBeDefined();
  });

  it("lists each missing release with its format, library code, artist, title, and missing-since date", () => {
    const album = createTestAlbum({
      id: 42,
      title: "On Your Own Love Again",
      format: "Vinyl",
      entry: 3,
      date_lost: "2026-07-01",
      artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 55, genre: "Rock" }),
    });
    mockUseMissingReleases.mockReturnValue({
      results: [album],
      total: 1,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("Vinyl")).toBeDefined();
    expect(screen.getByText("Jessica Pratt")).toBeDefined();
    expect(screen.getByText("On Your Own Love Again")).toBeDefined();
    expect(screen.getByText("RO 55/3")).toBeDefined();
    expect(screen.getByText("Total missing: 1")).toBeDefined();
  });

  it("shows 'Various Artists' for compilation rows, matching the search-results convention", () => {
    const album = createTestAlbum({
      id: 43,
      album_artist: "Various Artists",
      artist: createTestArtist({ name: "Autechre" }),
    });
    mockUseMissingReleases.mockReturnValue({
      results: [album],
      total: 1,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("Various Artists")).toBeDefined();
    expect(screen.queryByText("Autechre")).toBeNull();
  });

  it("shows 'Unknown' rather than a formatted date when date_lost is absent", () => {
    const album = createTestAlbum({ id: 44, date_lost: null });
    mockUseMissingReleases.mockReturnValue({
      results: [album],
      total: 1,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("Unknown")).toBeDefined();
  });

  it("calls markFound with the release's albumId when 'Mark as Found' is clicked — DJ-accessible action", async () => {
    const user = userEvent.setup();
    const album = createTestAlbum({ id: 99 });
    mockUseMissingReleases.mockReturnValue({
      results: [album],
      total: 1,
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    await user.click(screen.getByText("Mark as Found"));

    expect(mockMarkFound).toHaveBeenCalledWith({ albumId: 99 });
  });

  it("shows a loading state before the first page resolves", () => {
    mockUseMissingReleases.mockReturnValue({
      results: [],
      total: 0,
      isLoading: true,
      isError: false,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("shows an error state when the query fails", () => {
    mockUseMissingReleases.mockReturnValue({
      results: [],
      total: 0,
      isLoading: false,
      isError: true,
    });

    renderWithProviders(<MissingReleases />);

    expect(screen.getByText("Error loading missing releases. Please try again.")).toBeDefined();
  });
});
