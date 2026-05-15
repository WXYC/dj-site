import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import { renderWithProviders } from "@/lib/test-utils/render";
import type { TrackMatchHint } from "@/lib/features/catalog/types";

const mockSearchCatalogQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("searchString=sentimental"),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useSearchCatalogQuery: (...args: unknown[]) => mockSearchCatalogQuery(...args),
  };
});

import SearchResults from "../SearchResults";

function renderWithMatchedVia(matched_via: TrackMatchHint[] | undefined) {
  const album = createTestAlbum({
    artist: createTestArtist({
      name: "Duke Ellington & John Coltrane",
      lettercode: "JA",
      numbercode: 7,
    }),
    title: "Duke Ellington & John Coltrane",
    matched_via,
  });
  mockSearchCatalogQuery.mockReturnValue({
    data: [album],
    isLoading: false,
    error: undefined,
  });
  renderWithProviders(<SearchResults />);
}

describe("Classic SearchResults matched_via chip", () => {
  it("does not render any matched-track chip when matched_via is undefined", () => {
    renderWithMatchedVia(undefined);
    expect(screen.queryByText(/matched on track/i)).toBeNull();
  });

  it("does not render any matched-track chip when matched_via is an empty array", () => {
    renderWithMatchedVia([]);
    expect(screen.queryByText(/matched on track/i)).toBeNull();
  });

  it("renders a single chip with 'matched on track: <title>' when matched_via has one hint", () => {
    renderWithMatchedVia([
      {
        source: "cta",
        title: "In a Sentimental Mood",
        artist_credit: "Duke Ellington & John Coltrane",
        confidence: 1.0,
      },
    ]);
    expect(
      screen.getByText("matched on track: In a Sentimental Mood")
    ).toBeDefined();
  });

  it("exposes artist_credit via the title attribute (native tooltip) when present", () => {
    renderWithMatchedVia([
      {
        source: "discogs_master",
        title: "In a Sentimental Mood",
        artist_credit: "Duke Ellington & John Coltrane",
        position: "A1",
        confidence: 0.92,
      },
    ]);
    const chip = screen.getByText("matched on track: In a Sentimental Mood");
    expect(chip.getAttribute("title")).toContain("Duke Ellington & John Coltrane");
  });

  it("renders up to 3 matched-track chips inline", () => {
    renderWithMatchedVia([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
    ]);
    expect(screen.getByText("matched on track: Track One")).toBeDefined();
    expect(screen.getByText("matched on track: Track Two")).toBeDefined();
    expect(screen.getByText("matched on track: Track Three")).toBeDefined();
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
  });

  it("collapses overflow past 3 hints into a '+N more' chip", () => {
    renderWithMatchedVia([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
      { source: "discogs_release", title: "Track Four", confidence: 0.7 },
      { source: "discogs_release", title: "Track Five", confidence: 0.6 },
    ]);
    expect(screen.getByText("matched on track: Track One")).toBeDefined();
    expect(screen.getByText("matched on track: Track Two")).toBeDefined();
    expect(screen.getByText("matched on track: Track Three")).toBeDefined();
    expect(screen.queryByText("matched on track: Track Four")).toBeNull();
    expect(screen.queryByText("matched on track: Track Five")).toBeNull();
    expect(screen.getByText("+2 more")).toBeDefined();
  });

  it("renders chips as keyboard-focusable elements", () => {
    renderWithMatchedVia([
      { source: "cta", title: "In a Sentimental Mood", confidence: 1.0 },
    ]);
    const chip = screen.getByText("matched on track: In a Sentimental Mood");
    expect(chip.getAttribute("tabindex")).toBe("0");
  });

  it("renders the +N more chip as keyboard-focusable with overflow titles in its tooltip", () => {
    renderWithMatchedVia([
      { source: "cta", title: "Track One", confidence: 1.0 },
      { source: "discogs_master", title: "Track Two", confidence: 0.9 },
      { source: "discogs_release", title: "Track Three", confidence: 0.8 },
      { source: "discogs_release", title: "Track Four", confidence: 0.7 },
    ]);
    const more = screen.getByText("+1 more");
    expect(more.getAttribute("tabindex")).toBe("0");
    expect(more.getAttribute("title")).toContain("Track Four");
  });
});
