import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, createTestStore } from "@/tests/helpers";
import { applicationSlice } from "@/lib/features/application/frontend";
import { createTestAccountResult } from "@/tests/helpers";
import Rightbar from "@/src/components/experiences/modern/Rightbar/Rightbar";

const routing = vi.hoisted(() => ({
  pathname: "/dashboard/catalog",
  isDesktop: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routing.pathname,
}));

vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => routing.isDesktop,
}));

// Mock child components
vi.mock("@/src/components/experiences/modern/Rightbar/RightbarMobileClose", () => ({
  default: () => <div data-testid="rightbar-mobile-close">Mobile Close</div>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/RightbarContainer", () => ({
  default: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div data-testid="rightbar-container" data-variant={variant ?? "full"}>
      {children}
    </div>
  ),
}));

vi.mock("@/src/components/experiences/modern/Rightbar/NowPlayingContent", () => ({
  default: () => <div data-testid="now-playing-content">Now Playing</div>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/Bin/BinContent", () => ({
  default: () => <div data-testid="bin-content">Bin Content</div>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/PinnedRail", () => ({
  default: ({ activeAlbumId }: { activeAlbumId: number | null }) => (
    <div data-testid="pinned-rail">Rail active={String(activeAlbumId)}</div>
  ),
}));

vi.mock("@/src/components/experiences/modern/Rightbar/RailCollapse", () => ({
  default: () => <div data-testid="rail-collapse">Collapse</div>,
}));

vi.mock("@/src/components/experiences/modern/catalog/album/DockedAlbumCard", () => ({
  default: ({ albumId }: { albumId: number }) => (
    <div data-testid="docked-album-card">Album {albumId}</div>
  ),
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/SettingsPanel", () => ({
  default: () => <div data-testid="settings-panel">Settings</div>,
}));

vi.mock("@/src/components/experiences/modern/Rightbar/panels/AccountEditPanel", () => ({
  default: () => <div data-testid="account-edit-panel">Account Edit</div>,
}));

// Mock MUI components
vi.mock("@mui/joy", () => ({
  Box: ({ children, sx }: { children?: React.ReactNode; sx?: any }) => (
    <div data-testid="box" style={{ minHeight: sx?.minHeight }}>
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

vi.mock("@/src/widgets/NowPlaying", () => ({
  default: () => <div data-testid="now-playing-widget">Widget</div>,
}));

describe("Rightbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routing.pathname = "/dashboard/catalog";
    routing.isDesktop = false;
  });

  it("should render default content with NowPlaying and Bin", () => {
    renderWithProviders(<Rightbar />);

    expect(screen.getByTestId("rightbar-mobile-close")).toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
    expect(screen.getByTestId("bin-content")).toBeInTheDocument();
    expect(screen.getAllByTestId("divider")).toHaveLength(2);
    expect(screen.getByTestId("box")).toBeInTheDocument();
  });

  it("should render components in correct order within container", () => {
    renderWithProviders(<Rightbar />);

    const container = screen.getByTestId("rightbar-container");
    const children = container.children;

    expect(children[0]).toHaveAttribute("data-testid", "now-playing-content");
    expect(children[1]).toHaveAttribute("data-testid", "divider");
    expect(children[2]).toHaveAttribute("data-testid", "bin-content");
    expect(children[3]).toHaveAttribute("data-testid", "divider");
    expect(children[4]).toHaveAttribute("data-testid", "box");
  });

  it("should render settings panel when panel type is settings", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.openPanel({ type: "settings" }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
  });

  it("should render account edit panel when panel type is account-edit", () => {
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.openPanel({
      type: "account-edit",
      account: createTestAccountResult(),
      isSelf: false,
      organizationSlug: "wxyc",
    }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("account-edit-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
  });

  it("should render the pinned rail on desktop when albums are pinned", () => {
    routing.isDesktop = true;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("pinned-rail")).toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toHaveAttribute("data-variant", "rail");
    expect(screen.queryByTestId("now-playing-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("docked-album-card")).not.toBeInTheDocument();
  });

  it("should dock the card when the URL's album is pinned", () => {
    routing.isDesktop = true;
    routing.pathname = "/dashboard/catalog/album/42";
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("docked-album-card")).toHaveTextContent("Album 42");
    expect(screen.getByTestId("pinned-rail")).toHaveTextContent("active=42");
  });

  it("should not dock the card when the URL's album is not pinned", () => {
    routing.isDesktop = true;
    routing.pathname = "/dashboard/catalog/album/7";
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.queryByTestId("docked-album-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("pinned-rail")).toBeInTheDocument();
  });

  it("should expand the full rightbar with a collapse affordance when railExpanded", () => {
    routing.isDesktop = true;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.setRailExpanded(true));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
    expect(screen.getByTestId("rail-collapse")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toHaveAttribute("data-variant", "full");
  });

  it("should suspend rail mode while a panel is open", () => {
    routing.isDesktop = true;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    store.dispatch(applicationSlice.actions.openPanel({ type: "settings" }));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toHaveAttribute("data-variant", "full");
  });

  it("should keep the full drawer below the dock breakpoint even with pins", () => {
    routing.isDesktop = false;
    const store = createTestStore();
    store.dispatch(applicationSlice.actions.pinAlbum(42));
    renderWithProviders(<Rightbar />, { store });

    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
    expect(screen.queryByTestId("pinned-rail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rail-collapse")).not.toBeInTheDocument();
  });
});
