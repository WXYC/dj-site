import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

const mockBack = vi.fn();
const mockPush = vi.fn();
const mockParams = vi.fn<() => { id: string }>(() => ({ id: "42" }));
const mockPathname = vi.fn<() => string>(() => "/dashboard/album/42");
const mockUseGetInformationQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useParams: () => mockParams(),
  usePathname: () => mockPathname(),
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockUseGetInformationQuery(...args),
  };
});

vi.mock("@/lib/features/metadata/hooks", () => ({
  useAlbumArtwork: () => ({ artworkUrl: null, isLoading: false, metadata: null }),
  useArtistMetadata: () => ({ artistMetadata: null, bioTokens: null }),
}));

// Stub the content cards so the test asserts branch selection without pulling
// in AlbumCard's own data dependencies.
vi.mock("@/src/components/experiences/modern/catalog/album/AlbumCard", () => ({
  default: () => <div data-testid="album-card" />,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/AlbumErrorCard", () => ({
  default: () => <div data-testid="album-error" />,
}));
vi.mock("@/src/components/experiences/modern/catalog/album/AlbumLoadingCard", () => ({
  default: () => <div data-testid="album-loading" />,
}));

import AlbumPopup from "@/app/dashboard/@information/(.)album/[id]/page";

function setHistoryLength(n: number) {
  Object.defineProperty(window.history, "length", { configurable: true, value: n });
}

const foundAlbum = {
  data: { id: 42, title: "Confield", artist: { name: "Autechre" } },
  isLoading: false,
  isError: false,
};

describe("AlbumPopup — permalinkable album modal (#979)", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockUseGetInformationQuery.mockReset();
    mockParams.mockReturnValue({ id: "42" });
    mockPathname.mockReturnValue("/dashboard/album/42");
    setHistoryLength(2); // default: arrived via in-app navigation
  });

  it("renders the loading card while the album query is loading", () => {
    mockUseGetInformationQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<AlbumPopup />);
    expect(screen.getByTestId("album-loading")).toBeInTheDocument();
  });

  it("renders the error card when the album query errors", () => {
    mockUseGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<AlbumPopup />);
    expect(screen.getByTestId("album-error")).toBeInTheDocument();
  });

  it("renders the album card on success", () => {
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    renderWithProviders(<AlbumPopup />);
    expect(screen.getByTestId("album-card")).toBeInTheDocument();
  });

  it("passes the numeric route id to the album query", () => {
    mockUseGetInformationQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<AlbumPopup />);
    expect(mockUseGetInformationQuery).toHaveBeenCalledWith(
      { album_id: 42 },
      expect.objectContaining({ skip: false }),
    );
  });

  it("skips the query for a non-numeric id and shows the error card", () => {
    mockParams.mockReturnValue({ id: "abc" });
    mockUseGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderWithProviders(<AlbumPopup />);
    expect(mockUseGetInformationQuery).toHaveBeenCalledWith(
      { album_id: Number("abc") }, // NaN
      expect.objectContaining({ skip: true }),
    );
    expect(screen.getByTestId("album-error")).toBeInTheDocument();
  });

  it("dismisses via router.back() when there is in-app history", () => {
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    setHistoryLength(2);
    renderWithProviders(<AlbumPopup />);
    fireEvent.click(screen.getByLabelText("Close album detail"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("dismisses to the dashboard home on a cold permalink load (no in-app history)", () => {
    // A pasted permalink in a fresh tab has history.length === 1; router.back()
    // would dead-end, so dismissal falls back to a push. (#979 review finding #1)
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    setHistoryLength(1);
    renderWithProviders(<AlbumPopup />);
    fireEvent.click(screen.getByLabelText("Close album detail"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("unmounts the dialog immediately on dismissal, before any navigation lands", () => {
    // The navigation that follows a dismissal does not reliably re-render
    // this intercepted slot, so the dialog must disappear from local state
    // at click time, not when the router catches up.
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    setHistoryLength(2);
    renderWithProviders(<AlbumPopup />);
    fireEvent.click(screen.getByLabelText("Close album detail"));
    expect(screen.queryByLabelText("Close album detail")).not.toBeInTheDocument();
  });

  it("unmounts the dialog on browser back to a non-album URL", () => {
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    renderWithProviders(<AlbumPopup />);
    expect(screen.getByLabelText("Close album detail")).toBeInTheDocument();

    window.history.replaceState(null, "", "/dashboard/catalog");
    fireEvent.popState(window);
    expect(screen.queryByLabelText("Close album detail")).not.toBeInTheDocument();
  });

  it("renders nothing once the pathname leaves the album route", () => {
    // After a dismissal back(), the router can leave this intercepted slot
    // mounted with stale content while the URL is already the underlying
    // page's. The URL decides whether the modal exists.
    mockUseGetInformationQuery.mockReturnValue(foundAlbum);
    mockPathname.mockReturnValue("/dashboard/catalog");
    renderWithProviders(<AlbumPopup />);
    expect(screen.queryByLabelText("Close album detail")).not.toBeInTheDocument();
  });
});
