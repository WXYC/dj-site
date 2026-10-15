import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import {
  createTestAlbum,
  createTestArtist,
  fakeReviewsEndpoints,
  renderWithProviders,
  review,
} from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

const reviewsPanel = vi.hoisted(() => ({ record: null as null | { artist: string } }));
vi.mock("@/src/components/experiences/modern/reviews/ReviewsPanel", () => ({
  default: ({ record }: { record: { artist: string } }) => {
    reviewsPanel.record = record;
    return <span>mocked reviews panel</span>;
  },
}));
vi.mock("@/src/components/experiences/modern/catalog/album/LibraryStatus", () => ({ default: () => null }));
vi.mock("@/src/components/experiences/modern/catalog/album/StreamingLinks", () => ({ default: () => null }));
vi.mock("@/src/components/experiences/modern/catalog/album/Tracklist", () => ({ default: () => null }));
vi.mock("@/src/components/experiences/modern/catalog/album/CompilationCreditsControl", () => ({ default: () => null }));

import ReleaseSlipScreen from "@/src/components/experiences/modern/reviews/ReleaseSlipScreen";
import { useReviewRecord } from "@/src/components/experiences/modern/reviews/useReviewRecord";
import AlbumCard from "@/src/components/experiences/modern/catalog/album/AlbumCard";

const ALBUM_ID = 7;
const SHELF = "Various Artists - Rock - S";

const serve = (alternate: string | null | undefined, lettercode = "V/A") =>
  fakeReviewsEndpoints({
    releases: [
      {
        id: ALBUM_ID,
        album_title: "Aluminum Tunes",
        title: "Aluminum Tunes",
        artist_name: SHELF,
        code_letters: lettercode,
        label: "Duophonic",
        alternate_artist_name: alternate,
      },
    ],
    reviews: [review({ id: 40, album_id: ALBUM_ID, intake_item_id: null, medium: "typed", status: "submitted" })],
  });

const CASES: [string, string | null | undefined, string][] = [
  ["set", "Stereolab", "V/A Stereolab"],
  ["unset", null, SHELF],
  ["blank", "   ", SHELF],
];

describe("review surfaces name a release that is not a compilation by its bare alternate name", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    reviewsPanel.record = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("names it on the release slip page's lead line", async () => {
    serve("Stereolab", "SPA");
    renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={40} />);
    const lead = await screen.findByText(/This prints/);
    expect(lead).toHaveTextContent(`for the cover of Stereolab — Aluminum Tunes`);
  });

  it("names it in the record the editor and My reviews rows read", async () => {
    serve("Stereolab", "SPA");
    const store = makeStore();
    const { result } = renderHook(() => useReviewRecord(review({ id: 40, album_id: ALBUM_ID, intake_item_id: null })), {
      wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>,
    });
    await waitFor(() => expect(result.current?.artist).toBe("Stereolab"));
  });

  it("hands the reviews panel the bare alternate name", () => {
    const album = createTestAlbum({
      id: ALBUM_ID,
      title: "Aluminum Tunes",
      artist: createTestArtist({ name: "Juana Molina", lettercode: "MO", numbercode: 12 }),
      alternate_artist: "Stereolab",
    });
    renderWithProviders(
      <AlbumCard
        album={album}
        artworkUrl=""
        metadata={null}
        metadataLoading={false}
        artistBio={null}
        bioTokens={null}
        artistWikipediaUrl={null}
      />,
    );
    expect(reviewsPanel.record?.artist).toBe("Stereolab");
  });
});

describe("review surfaces name a compilation by its displayed artist", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
    reviewsPanel.record = null;
  });
  afterEach(() => vi.unstubAllEnvs());

  describe.each(CASES)("alternate artist name %s", (_label, alternate, expected) => {
    it("names it on the release slip page's lead line", async () => {
      serve(alternate);
      renderWithProviders(<ReleaseSlipScreen albumId={ALBUM_ID} reviewId={40} />);
      const lead = await screen.findByText(/This prints/);
      expect(lead).toHaveTextContent(`for the cover of ${expected} — Aluminum Tunes`);
    });

    it("names it in the record the editor and My reviews rows read", async () => {
      serve(alternate);
      const store = makeStore();
      const { result } = renderHook(() => useReviewRecord(review({ id: 40, album_id: ALBUM_ID, intake_item_id: null })), {
        wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>,
      });
      await waitFor(() => expect(result.current?.artist).toBe(expected));
    });

    it("hands the reviews panel the displayed artist and keeps the shelf name in the header", () => {
      const album = createTestAlbum({
        id: ALBUM_ID,
        title: "Aluminum Tunes",
        artist: createTestArtist({ name: SHELF, lettercode: "V/A", numbercode: 0 }),
        alternate_artist: alternate ?? undefined,
      });
      renderWithProviders(
        <AlbumCard
          album={album}
          artworkUrl=""
          metadata={null}
          metadataLoading={false}
          artistBio={null}
          bioTokens={null}
          artistWikipediaUrl={null}
        />,
      );
      expect(reviewsPanel.record?.artist).toBe(expected);
      expect(screen.getByText(new RegExp(`${SHELF} • Aluminum Tunes`))).toBeInTheDocument();
    });
  });
});
