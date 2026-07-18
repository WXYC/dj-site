import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import PinnedRail from "@/src/components/experiences/modern/Rightbar/PinnedRail";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/flowsheet",
}));

vi.mock("@/lib/features/catalog/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useGetInformationQuery: () => ({ data: undefined }),
}));

describe("PinnedRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderRail(pins: number[], { railExpanded = false, activeAlbumId = null as number | null } = {}) {
    const store = createTestStore();
    pins.forEach((id) => store.dispatch(applicationSlice.actions.pinAlbum(id)));
    if (railExpanded) store.dispatch(applicationSlice.actions.setRailExpanded(true));
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
    renderRail([42], { railExpanded: true });

    fireEvent.click(screen.getByLabelText("Collapse the dashboard panel"));
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
  });

  it("opens a pinned album and dismisses the home panel", () => {
    renderRail([42], { railExpanded: true });

    fireEvent.click(screen.getByLabelText("Open Pinned album"));
    expect(push).toHaveBeenCalledWith("/dashboard/flowsheet/album/42");
    expect(screen.getByLabelText("Expand the dashboard panel")).toBeInTheDocument();
  });

  it("unpins an album from its badge", () => {
    renderRail([42, 7]);

    fireEvent.click(screen.getAllByLabelText("Unpin Pinned album")[0]);
    expect(screen.getAllByLabelText("Open Pinned album")).toHaveLength(1);
  });
});
