import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import useOpenAlbumDetail from "@/src/components/experiences/modern/catalog/album/useOpenAlbumDetail";

const push = vi.fn();
const routing = vi.hoisted(() => ({
  pathname: "/dashboard/catalog",
  isDesktop: true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => routing.pathname,
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => routing.isDesktop,
}));

function Probe({ albumId }: { albumId: number }) {
  const openAlbumDetail = useOpenAlbumDetail();
  return (
    <button onClick={() => openAlbumDetail(albumId)}>open album</button>
  );
}

describe("useOpenAlbumDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routing.pathname = "/dashboard/catalog";
    routing.isDesktop = true;
  });

  it("surfaces a pinned album's pane even when its URL is already current", () => {
    routing.pathname = "/dashboard/catalog/album/42";
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.setDockView("collapsed"));
    renderWithProviders(<Probe albumId={42} />, { store });

    fireEvent.click(screen.getByText("open album"));

    expect(applicationSlice.selectors.getDockView(store.getState())).toBe("album");
    expect(applicationSlice.selectors.getDockAlbumId(store.getState())).toBe(42);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens a pinned album's pane and navigates when the URL differs", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.setDockView("collapsed"));
    renderWithProviders(<Probe albumId={42} />, { store });

    fireEvent.click(screen.getByText("open album"));

    expect(applicationSlice.selectors.getDockView(store.getState())).toBe("album");
    expect(push).toHaveBeenCalledWith("/dashboard/catalog/album/42");
  });

  it("navigates without touching the dock for an unpinned album", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(7));
    store.dispatch(applicationSlice.actions.setDockView("collapsed"));
    renderWithProviders(<Probe albumId={42} />, { store });

    fireEvent.click(screen.getByText("open album"));

    expect(applicationSlice.selectors.getDockView(store.getState())).toBe("collapsed");
    expect(push).toHaveBeenCalledWith("/dashboard/catalog/album/42");
  });

  it("navigates without touching the dock below the dock breakpoint", () => {
    routing.isDesktop = false;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.setDockView("collapsed"));
    renderWithProviders(<Probe albumId={42} />, { store });

    fireEvent.click(screen.getByText("open album"));

    expect(applicationSlice.selectors.getDockView(store.getState())).toBe("collapsed");
    expect(push).toHaveBeenCalledWith("/dashboard/catalog/album/42");
  });
});
