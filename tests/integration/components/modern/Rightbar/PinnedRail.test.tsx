import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import PinnedRail from "@/src/components/experiences/modern/Rightbar/PinnedRail";

const push = vi.fn();
const routing = vi.hoisted(() => ({
  pathname: "/dashboard/flowsheet",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => routing.pathname,
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useGetInformationQuery: () => ({ data: undefined }),
}));

describe("PinnedRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routing.pathname = "/dashboard/flowsheet";
  });

  function renderRail(pins: number[], { homeOpen = false, activeAlbumId = null as number | null } = {}) {
    const store = createTestStore();
    pins.forEach((id) => store.dispatch(applicationSlice.actions.pinAlbum(id)));
    if (homeOpen) store.dispatch(applicationSlice.actions.setDockView("home"));
    const view = renderWithProviders(<PinnedRail activeAlbumId={activeAlbumId} />, { store });
    return { store, view };
  }

  it("renders one tile per pinned album", () => {
    renderRail([42, 7]);
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(2);
  });

  it("expands the home panel from the dashboard-app button", () => {
    renderRail([42]);

    fireEvent.click(screen.getByLabelText("Expand the dashboard panel"));
    expect(screen.getByLabelText("Collapse the dashboard panel")).toBeInTheDocument();
  });

  it("collapses the home panel when the dashboard-app button is clicked again", () => {
    renderRail([42], { homeOpen: true });

    fireEvent.click(screen.getByLabelText("Collapse the dashboard panel"));
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
  });

  it("navigates to a pinned album that is not already open", () => {
    renderRail([42]);

    fireEvent.click(screen.getByLabelText("Open Pinned album"));
    expect(push).toHaveBeenCalledWith("/dashboard/flowsheet/album/42");
  });

  it("switches the dock to the album pane when its URL is already active", () => {
    routing.pathname = "/dashboard/flowsheet/album/42";
    renderRail([42], { homeOpen: true, activeAlbumId: 42 });

    fireEvent.click(screen.getByLabelText("Open Pinned album"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
  });

  it("unpins an album from its badge", () => {
    renderRail([42, 7]);

    fireEvent.click(screen.getAllByLabelText("Unpin Pinned album")[0]);
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("hands the pane to home and defers the unpin until navigation lands when unpinning the album in view", () => {
    routing.pathname = "/dashboard/flowsheet/album/42";
    const { view } = renderRail([42, 7], { activeAlbumId: 42 });

    fireEvent.click(screen.getAllByLabelText("Unpin Pinned album")[0]);
    expect(screen.getByLabelText("Collapse the dashboard panel")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/dashboard/flowsheet");
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(2);

    routing.pathname = "/dashboard/flowsheet";
    view.rerender(<PinnedRail activeAlbumId={null} />);
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(1);
  });

  it("keeps the dock collapsed when unpinning a hidden album", () => {
    routing.pathname = "/dashboard/flowsheet/album/42";
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.pinAlbum(7));
    store.dispatch(applicationSlice.actions.setDockView("collapsed"));
    const view = renderWithProviders(<PinnedRail activeAlbumId={null} />, { store });

    fireEvent.click(screen.getAllByLabelText("Unpin Pinned album")[0]);
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/dashboard/flowsheet");

    routing.pathname = "/dashboard/flowsheet";
    view.rerender(<PinnedRail activeAlbumId={null} />);
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(1);
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
  });
});
