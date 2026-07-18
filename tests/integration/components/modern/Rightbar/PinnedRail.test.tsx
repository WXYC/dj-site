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
    renderWithProviders(<PinnedRail activeAlbumId={activeAlbumId} />, { store });
    return store;
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
  });
});
