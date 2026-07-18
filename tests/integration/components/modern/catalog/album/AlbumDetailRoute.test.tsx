import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import AlbumDetailRoute from "@/src/components/experiences/modern/catalog/album/AlbumDetailRoute";

const routing = vi.hoisted(() => ({
  isDesktop: false,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "42" }),
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => routing.isDesktop,
}));

vi.mock("@/src/components/experiences/modern/catalog/album/AlbumDetailModal", () => ({
  default: () => <div data-testid="album-detail-modal">Modal</div>,
}));

describe("AlbumDetailRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routing.isDesktop = false;
  });

  it("renders the centered modal when the album is not pinned", () => {
    routing.isDesktop = true;
    renderWithProviders(<AlbumDetailRoute />);

    expect(screen.getByTestId("album-detail-modal")).toBeInTheDocument();
  });

  it("renders nothing on desktop when the album is pinned (docked card takes over)", () => {
    routing.isDesktop = true;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<AlbumDetailRoute />, { store });

    expect(screen.queryByTestId("album-detail-modal")).not.toBeInTheDocument();
  });

  it("keeps the modal below the dock breakpoint even when pinned", () => {
    routing.isDesktop = false;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<AlbumDetailRoute />, { store });

    expect(screen.getByTestId("album-detail-modal")).toBeInTheDocument();
  });

  it("renders the modal when a different album is pinned", () => {
    routing.isDesktop = true;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(7));
    renderWithProviders(<AlbumDetailRoute />, { store });

    expect(screen.getByTestId("album-detail-modal")).toBeInTheDocument();
  });
});
